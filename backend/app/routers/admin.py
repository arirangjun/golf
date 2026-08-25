from dataclasses import asdict
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.dependencies import DbSession, admin_user
from app.exceptions import ApiError
from app.models import Role, User
from app.services.auth_service import SessionUser
from app.services.booking_rules import (
    format_date,
    format_hour,
    get_week_range,
    now_kst,
    parse_date_input,
)
from app.services.excel_service import build_member_template_buffer, parse_member_excel
from app.services.formatting import (
    format_member_display,
    format_phone,
    format_unit,
    hash_password,
    normalize_phone,
)
from app.services.member_service import (
    MemberInput,
    count_members_with_unit_password,
    create_member,
    delete_member,
    import_members,
)
from app.services.reservation_service import (
    cancel_reservation,
    count_user_reservations_within_retention,
    create_reservation,
    get_all_reservations,
    get_monthly_member_stats,
    get_reservation_export_rows,
    get_reservation_stats,
    get_slots_for_week,
)
from app.services.excel_service import build_stats_export_buffer

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUserBody(BaseModel):
    name: str = Field(min_length=1)
    dong: str = Field(min_length=1)
    ho: str = Field(min_length=1)
    phone: str | None = None
    password: str | None = Field(default=None, min_length=1)


class UpdateUserBody(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    dong: str | None = Field(default=None, min_length=1)
    ho: str | None = Field(default=None, min_length=1)
    phone: str | None = None
    password: str | None = Field(default=None, min_length=1)
    role: str | None = None
    isActive: bool | None = None


class AdminCreateReservationBody(BaseModel):
    userId: str = Field(min_length=1)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    startHour: int = Field(ge=0, le=23)


@router.get("/users")
def list_users(db: DbSession, _admin: SessionUser = Depends(admin_user)):
    users = db.query(User).order_by(User.createdAt.desc()).all()
    result = []
    for user in users:
        reservation_count = count_user_reservations_within_retention(db, user.id)
        result.append(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "phone": format_phone(user.phone),
                "dong": user.dong,
                "ho": user.ho,
                "unitLabel": format_unit(user.dong, user.ho),
                "displayName": format_member_display(user.dong, user.name),
                "role": user.role.value,
                "isActive": user.isActive,
                "createdAt": user.createdAt.isoformat(),
                "reservationCount": reservation_count,
            }
        )
    return {"users": result}


@router.post("/users", status_code=201)
def create_user(body: CreateUserBody, db: DbSession, _admin: SessionUser = Depends(admin_user)):
    from app.services.member_service import MemberInput

    user = create_member(
        db,
        MemberInput(
            name=body.name,
            dong=body.dong,
            ho=body.ho,
            phone=body.phone or "",
            password=body.password,
        ),
    )
    data = asdict(user)
    data["role"] = user.role.value
    data["createdAt"] = user.createdAt.isoformat()
    return {"user": data}


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserBody,
    db: DbSession,
    admin: SessionUser = Depends(admin_user),
):
    if user_id == admin.id and body.role == "USER":
        raise ApiError("VALIDATION_ERROR", "본인의 관리자 권한은 해제할 수 없습니다.")
    if user_id == admin.id and body.isActive is False:
        raise ApiError("VALIDATION_ERROR", "본인 계정은 비활성화할 수 없습니다.")

    current = db.query(User).filter(User.id == user_id).first()
    if not current:
        raise ApiError("NOT_FOUND", "회원을 찾을 수 없습니다.", 404)

    new_dong = body.dong.strip() if body.dong else current.dong
    new_ho = body.ho.strip() if body.ho else current.ho

    if body.name is not None:
        current.name = body.name
    if body.dong is not None:
        current.dong = new_dong
    if body.ho is not None:
        current.ho = new_ho
    if body.phone is not None:
        current.phone = normalize_phone(body.phone)
    if body.role is not None:
        current.role = Role(body.role)
    if body.isActive is not None:
        current.isActive = body.isActive
    if body.password:
        if count_members_with_unit_password(db, new_dong, new_ho, body.password, user_id) > 0:
            raise ApiError(
                "VALIDATION_ERROR",
                "같은 동·호수에 이미 동일 비밀번호를 사용하는 회원이 있습니다.",
            )
        current.passwordHash = hash_password(body.password)

    db.commit()
    db.refresh(current)
    return {
        "user": {
            "id": current.id,
            "email": current.email,
            "name": current.name,
            "phone": format_phone(current.phone),
            "dong": current.dong,
            "ho": current.ho,
            "unitLabel": format_unit(current.dong, current.ho),
            "displayName": format_member_display(current.dong, current.name),
            "role": current.role.value,
            "isActive": current.isActive,
        }
    }


@router.delete("/users/{user_id}")
def remove_user(
    user_id: str,
    db: DbSession,
    admin: SessionUser = Depends(admin_user),
):
    if user_id == admin.id:
        raise ApiError("VALIDATION_ERROR", "본인 계정은 삭제할 수 없습니다.")
    delete_member(db, user_id)
    return {"ok": True}


@router.post("/users/import")
async def import_users(
    db: DbSession,
    file: UploadFile = File(...),
    _admin: SessionUser = Depends(admin_user),
):
    if not file.filename:
        raise ApiError("VALIDATION_ERROR", "엑셀 파일을 선택해 주세요.")

    name = file.filename.lower()
    if not (name.endswith(".xlsx") or name.endswith(".xls")):
        raise ApiError("VALIDATION_ERROR", "xlsx 또는 xls 파일만 업로드할 수 있습니다.")

    content = await file.read()
    rows = parse_member_excel(content)
    if not rows:
        raise ApiError("VALIDATION_ERROR", "등록할 회원 데이터가 없습니다. 양식을 확인해 주세요.")

    result = import_members(db, rows)
    return {
        "created": result.created,
        "skipped": result.skipped,
        "errors": result.errors,
        "users": [
            {**asdict(u), "role": u.role.value, "createdAt": u.createdAt.isoformat()}
            for u in result.users
        ],
    }


@router.get("/users/template")
def user_template(_admin: SessionUser = Depends(admin_user)):
    buffer = build_member_template_buffer()
    return Response(
        content=buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="member-template.xlsx"'},
    )


@router.get("/reservations")
def admin_list_reservations(
    db: DbSession,
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    _admin: SessionUser = Depends(admin_user),
):
    from_date = parse_date_input(from_) if from_ else None
    to_date = parse_date_input(to) if to else None
    reservations = get_all_reservations(db, from_date, to_date)
    return {
        "reservations": [
            {
                "id": r.id,
                "date": format_date(r.date),
                "startHour": r.startHour,
                "endHour": r.endHour,
                "isSameDayBooking": r.isSameDayBooking,
                "timeLabel": f"{format_hour(r.startHour)} - {format_hour(r.endHour)}",
                "canCancel": True,
                "user": {
                    "id": r.user.id,
                    "name": r.user.name,
                    "email": r.user.email,
                    "dong": r.user.dong,
                    "displayName": format_member_display(r.user.dong, r.user.name),
                },
            }
            for r in reservations
        ]
    }


@router.post("/reservations", status_code=201)
def admin_create_reservation(
    body: AdminCreateReservationBody,
    db: DbSession,
    _admin: SessionUser = Depends(admin_user),
):
    return create_reservation(
        db,
        user_id=body.userId,
        target=parse_date_input(body.date),
        start_hour=body.startHour,
        is_admin=True,
    )


@router.delete("/reservations")
def admin_delete_reservation(
    db: DbSession,
    id: str = Query(...),
    admin: SessionUser = Depends(admin_user),
):
    cancel_reservation(db, id, admin.id, is_admin=True)
    return {"ok": True}


@router.get("/slots/week")
def admin_slots_week(
    db: DbSession,
    weekStart: str | None = Query(None),
    _admin: SessionUser = Depends(admin_user),
):
    if weekStart:
        week_start = parse_date_input(weekStart)
    else:
        week_start, _ = get_week_range(now_kst().date())

    days = get_slots_for_week(db, week_start, admin_view=True)
    week_start_date, week_end_date = get_week_range(week_start)
    return {
        "weekStart": format_date(week_start_date),
        "weekEnd": format_date(week_end_date),
        "days": [{"date": day.date, "slots": [slot.__dict__ for slot in day.slots]} for day in days],
    }


@router.get("/stats")
def admin_stats(
    db: DbSession,
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    _admin: SessionUser = Depends(admin_user),
):
    to_date = parse_date_input(to) if to else now_kst().date()
    from_date = parse_date_input(from_) if from_ else to_date - timedelta(days=30)
    return get_reservation_stats(db, from_date, to_date)


@router.get("/stats/members")
def admin_stats_members(
    db: DbSession,
    month: str | None = Query(None),
    _admin: SessionUser = Depends(admin_user),
):
    current = now_kst()
    if month:
        year = int(month.split("-")[0])
        month_num = int(month.split("-")[1])
    else:
        year = current.year
        month_num = current.month

    if month_num < 1 or month_num > 12:
        raise ApiError("VALIDATION_ERROR", "month 형식은 YYYY-MM 입니다.")

    return get_monthly_member_stats(db, year, month_num)


@router.get("/stats/export")
def admin_stats_export(
    db: DbSession,
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    month: str | None = Query(None),
    _admin: SessionUser = Depends(admin_user),
):
    to_date = parse_date_input(to) if to else now_kst().date()
    from_date = parse_date_input(from_) if from_ else to_date - timedelta(days=30)
    stats = get_reservation_stats(db, from_date, to_date)
    reservations = get_reservation_export_rows(db, from_date, to_date)

    member_stats = None
    if month:
        year = int(month.split("-")[0])
        month_num = int(month.split("-")[1])
        if 1 <= month_num <= 12:
            member_stats = get_monthly_member_stats(db, year, month_num)

    buffer = build_stats_export_buffer(
        {
            "from": format_date(from_date),
            "to": format_date(to_date),
            "month": month,
            "total": stats["total"],
            "daily": stats["daily"],
            "weekly": stats["weekly"],
            "monthly": stats["monthly"],
            "hourlyUtilization": stats["hourlyUtilization"],
            "memberStats": member_stats,
            "reservations": reservations,
        }
    )

    filename = f"stats-{month}.xlsx" if month else f"stats-{format_date(from_date)}_{format_date(to_date)}.xlsx"
    return Response(
        content=buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
