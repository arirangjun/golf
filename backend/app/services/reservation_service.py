from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.exceptions import ApiError
from app.models import Reservation, User
from app.services.booking_rules import (
    OPERATING_END_HOUR,
    OPERATING_START_HOUR,
    can_book_date,
    can_cancel_reservation,
    date_to_datetime,
    format_date,
    format_hour,
    get_all_day_hours,
    get_currently_bookable_week_range,
    get_next_booking_open_time,
    get_reservation_datetime,
    get_week_range,
    is_next_day_bonus_booking_allowed,
    is_operating_hour,
    is_same_day_extra_booking_allowed,
    now_kst,
    retention_cutoff,
    to_date_only,
)
from app.services.formatting import format_member_display, format_phone


@dataclass
class SlotInfo:
    startHour: int
    endHour: int
    available: bool
    isOperating: bool
    bookable: bool
    reservationId: str | None = None
    displayLabel: str | None = None
    isMine: bool | None = None


@dataclass
class DaySlots:
    date: str
    slots: list[SlotInfo]


def get_slots_for_date(
    db: Session,
    target: date,
    current_user_id: str | None = None,
    admin_view: bool = False,
) -> list[SlotInfo]:
    date_only = to_date_only(target)
    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.user))
        .filter(func.date(Reservation.date) == date_only)
        .all()
    )

    booked_map = {r.startHour: r for r in reservations}
    bookable = True if admin_view else can_book_date(date_only)

    slots: list[SlotInfo] = []
    current = now_kst()
    for hour in get_all_day_hours():
        reservation = booked_map.get(hour)
        operating = is_operating_hour(hour)
        # 관리자: 과거 슬롯도 예약 가능 / 회원: 과거 불가, 오픈 주간만
        slot_available = operating and reservation is None and bookable
        if slot_available and not admin_view:
            slot_time = get_reservation_datetime(date_only, hour)
            if slot_time <= current:
                slot_available = False
        slots.append(
            SlotInfo(
                startHour=hour,
                endHour=hour + 1,
                available=slot_available,
                isOperating=operating,
                bookable=bookable,
                reservationId=reservation.id if reservation else None,
                displayLabel=(
                    format_member_display(reservation.user.dong, reservation.user.name)
                    if reservation
                    else None
                ),
                isMine=reservation.userId == current_user_id if reservation else None,
            )
        )
    return slots


def get_slots_for_week(
    db: Session,
    week_start: date,
    current_user_id: str | None = None,
    admin_view: bool = False,
) -> list[DaySlots]:
    monday = to_date_only(week_start)
    days: list[DaySlots] = []
    for i in range(7):
        day = monday + timedelta(days=i)
        slots = get_slots_for_date(db, day, current_user_id, admin_view)
        days.append(DaySlots(date=format_date(day), slots=slots))
    return days


def count_weekly_reservations(db: Session, user_id: str, target: date) -> int:
    """해당 주(월~일) 기본 예약 건수 (익일 보너스 제외)."""
    start, end = get_week_range(target)
    return (
        db.query(Reservation)
        .filter(
            Reservation.userId == user_id,
            Reservation.isSameDayBooking.is_(False),
            func.date(Reservation.date) >= start,
            func.date(Reservation.date) <= end,
        )
        .count()
    )


def create_reservation(
    db: Session,
    user_id: str,
    target: date,
    start_hour: int,
    is_admin: bool = False,
) -> dict:
    current = now_kst()
    date_only = to_date_only(target)

    if start_hour < OPERATING_START_HOUR or start_hour >= OPERATING_END_HOUR:
        raise ApiError(
            "VALIDATION_ERROR",
            f"예약 가능 시간은 {format_hour(OPERATING_START_HOUR)} ~ {format_hour(OPERATING_END_HOUR)} 입니다.",
        )

    reservation_time = get_reservation_datetime(date_only, start_hour)
    # 관리자: 과거 포함 모든 시간 예약 가능 / 회원: 미래만
    if reservation_time <= current and not is_admin:
        raise ApiError("VALIDATION_ERROR", "과거 시간은 예약할 수 없습니다.")

    if not is_admin and not can_book_date(date_only, current):
        bookable = get_currently_bookable_week_range(current)
        if bookable:
            raise ApiError(
                "BOOKING_NOT_OPEN",
                f"현재 예약 가능한 기간은 {format_date(bookable[0])} ~ {format_date(bookable[1])} 입니다. "
                "주중(월~금)에는 이번 주(월~일)를 언제든 예약할 수 있습니다.",
            )
        next_open = get_next_booking_open_time(current)
        raise ApiError(
            "BOOKING_NOT_OPEN",
            f"예약 오픈 전입니다. {format_date(next_open)} {format_hour(next_open.hour)}부터 예약 가능합니다.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.isActive or user.deletedAt is not None:
        raise ApiError("USER_INACTIVE", "비활성화된 계정입니다.", 403)

    # 회원: 주간 1회 + 당일 빈 슬롯 추가 1회 + 21:00 이후 내일 추가 1회
    mark_as_bonus = False
    if not is_admin:
        weekly_used = count_weekly_reservations(db, user_id, date_only) >= 1
        if is_next_day_bonus_booking_allowed(date_only, current):
            mark_as_bonus = True
        elif is_same_day_extra_booking_allowed(date_only, current) and weekly_used:
            mark_as_bonus = True
        elif weekly_used:
            raise ApiError(
                "WEEKLY_LIMIT",
                "이번 주(월~일) 기본 예약은 1회만 가능합니다. "
                "당일 빈 슬롯은 추가 1회, 21:00 이후 내일 슬롯은 추가 1회 예약할 수 있습니다.",
            )

    try:
        # 동시 예약은 DB unique(date, startHour) + IntegrityError 로 방지
        # (세션이 이미 시작된 뒤 isolation_level 변경 시 500 발생하므로 사용하지 않음)
        existing = (
            db.query(Reservation)
            .filter(func.date(Reservation.date) == date_only, Reservation.startHour == start_hour)
            .first()
        )
        if existing:
            raise ApiError("SLOT_TAKEN", "이미 예약된 시간입니다.", 409)

        if not is_admin and not mark_as_bonus:
            week_start, week_end = get_week_range(date_only)
            weekly_count = (
                db.query(Reservation)
                .filter(
                    Reservation.userId == user_id,
                    Reservation.isSameDayBooking.is_(False),
                    func.date(Reservation.date) >= week_start,
                    func.date(Reservation.date) <= week_end,
                )
                .count()
            )
            if weekly_count >= 1:
                raise ApiError("WEEKLY_LIMIT", "이번 주(월~일) 기본 예약은 1회만 가능합니다.")

        if not is_admin and mark_as_bonus:
            bonus_count = (
                db.query(Reservation)
                .filter(
                    Reservation.userId == user_id,
                    Reservation.isSameDayBooking.is_(True),
                    func.date(Reservation.date) == date_only,
                )
                .count()
            )
            if bonus_count >= 1:
                if is_same_day_extra_booking_allowed(date_only, current):
                    raise ApiError("BONUS_LIMIT", "당일 추가 예약은 1회만 가능합니다.")
                raise ApiError("BONUS_LIMIT", "내일 추가 예약은 1회만 가능합니다.")

        reservation = Reservation(
            userId=user_id,
            date=date_to_datetime(date_only),
            startHour=start_hour,
            endHour=start_hour + 1,
            isSameDayBooking=mark_as_bonus,
        )
        db.add(reservation)
        db.commit()
        db.refresh(reservation)
        return {"id": reservation.id}
    except ApiError:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise ApiError("SLOT_TAKEN", "이미 예약된 시간입니다.", 409)
    except Exception:
        db.rollback()
        raise


def cancel_reservation(
    db: Session, reservation_id: str, user_id: str, is_admin: bool = False
) -> None:
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise ApiError("NOT_FOUND", "예약을 찾을 수 없습니다.", 404)

    if not is_admin and reservation.userId != user_id:
        raise ApiError("FORBIDDEN", "본인 예약만 취소할 수 있습니다.", 403)

    # 관리자: 언제든 취소 / 회원: 3시간 전까지만
    if not is_admin and not can_cancel_reservation(reservation.date, reservation.startHour):
        raise ApiError("CANCEL_TOO_LATE", "예약 3시간 전까지만 취소할 수 있습니다.")

    db.delete(reservation)
    db.commit()


def get_user_reservations(db: Session, user_id: str) -> list[Reservation]:
    cutoff = retention_cutoff()
    return (
        db.query(Reservation)
        .filter(
            Reservation.userId == user_id,
            func.date(Reservation.date) >= cutoff,
        )
        .order_by(Reservation.date.asc(), Reservation.startHour.asc())
        .all()
    )


def get_all_reservations(
    db: Session, from_date: date | None = None, to_date: date | None = None
) -> list[Reservation]:
    cutoff = retention_cutoff()
    effective_from = max(from_date, cutoff) if from_date else cutoff
    query = db.query(Reservation).options(joinedload(Reservation.user))
    query = query.filter(func.date(Reservation.date) >= effective_from)
    if to_date:
        query = query.filter(func.date(Reservation.date) <= to_date)
    return query.order_by(Reservation.date.asc(), Reservation.startHour.asc()).all()


def count_user_reservations_within_retention(db: Session, user_id: str) -> int:
    cutoff = retention_cutoff()
    return (
        db.query(Reservation)
        .filter(
            Reservation.userId == user_id,
            func.date(Reservation.date) >= cutoff,
        )
        .count()
    )


def get_reservation_export_rows(
    db: Session, from_date: date, to_date: date
) -> list[dict]:
    """기간별 엑셀용: 동/호수/이름/예약날짜/시간."""
    cutoff = retention_cutoff()
    effective_from = max(to_date_only(from_date), cutoff)
    effective_to = to_date_only(to_date)
    if effective_to < effective_from:
        return []

    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.user))
        .filter(
            func.date(Reservation.date) >= effective_from,
            func.date(Reservation.date) <= effective_to,
        )
        .order_by(Reservation.date.asc(), Reservation.startHour.asc(), Reservation.userId.asc())
        .all()
    )

    rows: list[dict] = []
    for reservation in reservations:
        user = reservation.user
        rows.append(
            {
                "dong": user.dong if user else "",
                "ho": user.ho if user else "",
                "name": user.name if user else "",
                "date": format_date(reservation.date),
                "time": format_hour(reservation.startHour),
            }
        )
    return rows


def delete_expired_reservations(db: Session) -> int:
    """1년 이전 예약 슬롯 날짜 기준 삭제. 삭제 건수 반환."""
    cutoff = retention_cutoff()
    deleted = (
        db.query(Reservation)
        .filter(func.date(Reservation.date) < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted or 0)


def get_monthly_member_stats(db: Session, year: int, month: int) -> dict:
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)

    cutoff = retention_cutoff()
    if month_end < cutoff:
        return {
            "month": f"{year}-{month:02d}",
            "members": [],
            "totalReservations": 0,
            "uniqueMembers": 0,
        }

    effective_start = max(month_start, cutoff)
    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.user))
        .filter(
            func.date(Reservation.date) >= effective_start,
            func.date(Reservation.date) <= month_end,
        )
        .all()
    )

    member_map: dict[str, dict] = {}
    for reservation in reservations:
        existing = member_map.get(reservation.userId)
        if existing:
            existing["count"] += 1
        else:
            member_map[reservation.userId] = {
                "dong": reservation.user.dong,
                "name": reservation.user.name,
                "phone": reservation.user.phone,
                "count": 1,
            }

    members = [
        {
            "userId": user_id,
            "dong": data["dong"],
            "name": data["name"],
            "phone": format_phone(data["phone"]),
            "displayName": format_member_display(data["dong"], data["name"]),
            "count": data["count"],
        }
        for user_id, data in member_map.items()
    ]
    members.sort(key=lambda m: (-m["count"], m["displayName"]))

    return {
        "month": f"{year}-{month:02d}",
        "members": members,
        "totalReservations": len(reservations),
        "uniqueMembers": len(members),
    }


def get_reservation_stats(db: Session, from_date: date, to_date: date) -> dict:
    cutoff = retention_cutoff()
    effective_from = max(to_date_only(from_date), cutoff)
    effective_to = to_date_only(to_date)
    if effective_to < effective_from:
        return {
            "daily": [],
            "weekly": [],
            "monthly": [],
            "hourlyUtilization": [
                {"hour": hour, "count": 0, "rate": 0} for hour in get_all_day_hours()
            ],
            "total": 0,
        }

    reservations = (
        db.query(Reservation)
        .filter(
            func.date(Reservation.date) >= effective_from,
            func.date(Reservation.date) <= effective_to,
        )
        .all()
    )

    daily_map: dict[str, int] = {}
    weekly_map: dict[str, int] = {}
    monthly_map: dict[str, int] = {}
    hourly_map: dict[int, int] = {}

    for reservation in reservations:
        day_key = format_date(reservation.date)
        daily_map[day_key] = daily_map.get(day_key, 0) + 1

        week_start, _ = get_week_range(reservation.date)
        week_key = format_date(week_start)
        weekly_map[week_key] = weekly_map.get(week_key, 0) + 1

        month_key = reservation.date.strftime("%Y-%m")
        monthly_map[month_key] = monthly_map.get(month_key, 0) + 1

        hourly_map[reservation.startHour] = hourly_map.get(reservation.startHour, 0) + 1

    total_days = max(1, (effective_to - effective_from).days + 1)

    return {
        "daily": [{"label": k, "count": v} for k, v in sorted(daily_map.items())],
        "weekly": [{"label": k, "count": v} for k, v in sorted(weekly_map.items())],
        "monthly": [{"label": k, "count": v} for k, v in sorted(monthly_map.items())],
        "hourlyUtilization": [
            {
                "hour": hour,
                "count": hourly_map.get(hour, 0),
                "rate": round((hourly_map.get(hour, 0) / total_days) * 100),
            }
            for hour in get_all_day_hours()
        ],
        "total": len(reservations),
    }
