from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.exceptions import ApiError
from app.models import Role, User
from app.services.auth_service import authenticate_member
from app.services.formatting import (
    default_member_password,
    format_member_display,
    format_phone,
    format_unit,
    generate_unique_member_email,
    hash_password,
    normalize_phone,
    verify_password,
)

__all__ = [
    "authenticate_member",
    "change_member_password",
    "create_member",
    "import_members",
    "count_members_with_unit_password",
]


@dataclass
class MemberInput:
    dong: str
    ho: str
    name: str
    phone: str = ""
    password: str | None = None


@dataclass
class CreatedMember:
    id: str
    email: str
    name: str
    phone: str
    dong: str
    ho: str
    role: Role
    isActive: bool
    createdAt: datetime
    unitLabel: str
    displayName: str
    reservationCount: int


@dataclass
class ImportRow:
    row: int
    dong: str
    ho: str
    name: str
    phone: str = ""
    password: str | None = None


@dataclass
class ImportResult:
    created: int
    skipped: int
    errors: list[dict]
    users: list[CreatedMember]


def _to_stored_phone(phone: str | None) -> str:
    return normalize_phone(phone) if phone else ""


def count_members_with_unit_password(
    db: Session, dong: str, ho: str, plain_password: str, exclude_user_id: str | None = None
) -> int:
    query = db.query(User).filter(User.dong == dong, User.ho == ho, User.role == Role.USER)
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
    users = query.all()
    return sum(1 for user in users if verify_password(plain_password, user.passwordHash))


def change_member_password(
    db: Session, user_id: str, current_password: str, new_password: str
) -> None:
    user = db.query(User).filter(User.id == user_id, User.role == Role.USER).first()
    if not user or not user.isActive:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)

    if not verify_password(current_password, user.passwordHash):
        raise ApiError("VALIDATION_ERROR", "현재 비밀번호가 올바르지 않습니다.")

    new_plain = new_password.strip()
    if not new_plain:
        raise ApiError("VALIDATION_ERROR", "새 비밀번호를 입력해 주세요.")
    if new_plain == current_password:
        raise ApiError("VALIDATION_ERROR", "새 비밀번호는 현재 비밀번호와 달라야 합니다.")

    if count_members_with_unit_password(db, user.dong, user.ho, new_plain, user.id) > 0:
        raise ApiError(
            "VALIDATION_ERROR",
            "같은 동·호수에 이미 동일 비밀번호를 사용하는 회원이 있습니다.",
        )

    user.passwordHash = hash_password(new_plain)
    db.commit()


def _format_created(user: User, reservation_count: int = 0) -> CreatedMember:
    return CreatedMember(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=format_phone(user.phone),
        dong=user.dong,
        ho=user.ho,
        role=user.role,
        isActive=user.isActive,
        createdAt=user.createdAt,
        unitLabel=format_unit(user.dong, user.ho),
        displayName=format_member_display(user.dong, user.name),
        reservationCount=reservation_count,
    )


def create_member(db: Session, input_data: MemberInput) -> CreatedMember:
    trimmed_dong = input_data.dong.strip()
    trimmed_ho = input_data.ho.strip()
    name = input_data.name.strip()
    phone = _to_stored_phone(input_data.phone)
    plain_password = (input_data.password or "").strip() or default_member_password()

    if not trimmed_dong or not trimmed_ho or not name:
        raise ApiError("VALIDATION_ERROR", "동, 호수, 이름을 모두 입력해 주세요.")

    if count_members_with_unit_password(db, trimmed_dong, trimmed_ho, plain_password) > 0:
        raise ApiError(
            "VALIDATION_ERROR",
            "같은 동·호수에 이미 동일 비밀번호를 사용하는 회원이 있습니다. 다른 비밀번호를 사용해 주세요.",
        )

    existing_emails = {row[0] for row in db.query(User.email).all()}
    email = generate_unique_member_email(trimmed_dong, trimmed_ho, existing_emails)

    user = User(
        name=name,
        phone=phone,
        dong=trimmed_dong,
        ho=trimmed_ho,
        email=email,
        passwordHash=hash_password(plain_password),
        role=Role.USER,
        isActive=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _format_created(user)


def import_members(db: Session, rows: list[ImportRow]) -> ImportResult:
    result = ImportResult(created=0, skipped=0, errors=[], users=[])
    seen_in_file: set[str] = set()
    existing_emails = {row[0] for row in db.query(User.email).all()}

    for row in rows:
        trimmed_dong = row.dong.strip()
        trimmed_ho = row.ho.strip()
        name = row.name.strip()
        phone = _to_stored_phone(row.phone)
        plain_password = (row.password or "").strip() or default_member_password()
        key = f"{trimmed_dong}:{trimmed_ho}:{plain_password}"

        if not trimmed_dong and not trimmed_ho and not name and not phone:
            continue

        if not trimmed_dong or not trimmed_ho or not name:
            result.errors.append({"row": row.row, "message": "동, 호수, 이름을 모두 입력해 주세요."})
            continue

        if key in seen_in_file:
            result.skipped += 1
            result.errors.append({"row": row.row, "message": "파일 내 동·호수·비밀번호 조합이 중복입니다."})
            continue
        seen_in_file.add(key)

        if count_members_with_unit_password(db, trimmed_dong, trimmed_ho, plain_password) > 0:
            result.skipped += 1
            result.errors.append(
                {"row": row.row, "message": "같은 동·호수에 이미 동일 비밀번호 회원이 있습니다."}
            )
            continue

        try:
            email = generate_unique_member_email(trimmed_dong, trimmed_ho, existing_emails)
            existing_emails.add(email)
            user = User(
                name=name,
                phone=phone,
                dong=trimmed_dong,
                ho=trimmed_ho,
                email=email,
                passwordHash=hash_password(plain_password),
                role=Role.USER,
                isActive=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            result.created += 1
            result.users.append(_format_created(user))
        except Exception:
            db.rollback()
            result.errors.append({"row": row.row, "message": "등록 중 오류가 발생했습니다."})

    return result
