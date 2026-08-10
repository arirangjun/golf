from dataclasses import dataclass

import jwt
from fastapi import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import ApiError
from app.models import Role, User
from app.services.booking_rules import now_kst
from app.services.formatting import hash_password, verify_password


@dataclass
class SessionUser:
    id: str
    email: str
    name: str
    role: Role


def _encode_token(user: SessionUser) -> str:
    payload = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "iat": now_kst(),
    }
    # 만료 없음 (로그아웃 전까지 유지)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> SessionUser | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": False},
        )
        return SessionUser(
            id=payload["id"],
            email=payload["email"],
            name=payload["name"],
            role=Role(payload["role"]),
        )
    except jwt.PyJWTError:
        return None


def set_session_cookie(response: Response, user: SessionUser) -> None:
    token = _encode_token(user)
    # max_age=None → 세션 쿠키가 아니라 사실상 영구 쿠키로 두려면 매우 큰 값 사용
    # Chrome 등은 상한이 있어 약 400일로 잘릴 수 있음. JWT 자체는 만료 없음.
    forever = 60 * 60 * 24 * 365 * 100  # 100년
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/",
        max_age=forever,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.cookie_name, path="/")


def authenticate_admin(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.isActive or user.role != Role.ADMIN:
        raise ApiError("UNAUTHORIZED", "관리자 계정 정보가 올바르지 않습니다.", 401)
    if not verify_password(password, user.passwordHash):
        raise ApiError("UNAUTHORIZED", "관리자 계정 정보가 올바르지 않습니다.", 401)
    return user


def authenticate_member(db: Session, dong: str, ho: str, password: str) -> User:
    trimmed_dong = dong.strip()
    trimmed_ho = ho.strip()

    users = (
        db.query(User)
        .filter(
            User.dong == trimmed_dong,
            User.ho == trimmed_ho,
            User.role == Role.USER,
            User.isActive.is_(True),
        )
        .all()
    )

    if not users:
        raise ApiError("UNAUTHORIZED", "등록되지 않았거나 비활성화된 회원입니다.", 401)

    matches = [user for user in users if verify_password(password, user.passwordHash)]

    if not matches:
        raise ApiError("UNAUTHORIZED", "동·호수 또는 비밀번호가 올바르지 않습니다.", 401)

    if len(matches) > 1:
        raise ApiError(
            "UNAUTHORIZED",
            "같은 동·호수에 동일 비밀번호 회원이 여러 명 있습니다. 관리자에게 문의해 주세요.",
            401,
        )

    return matches[0]


def to_session_user(user: User) -> SessionUser:
    return SessionUser(id=user.id, email=user.email, name=user.name, role=user.role)


def require_session(token: str | None) -> SessionUser:
    if not token:
        raise ApiError("UNAUTHORIZED", "로그인이 필요합니다.", 401)
    session = decode_token(token)
    if not session:
        raise ApiError("UNAUTHORIZED", "로그인이 필요합니다.", 401)
    return session


def require_admin(db: Session, token: str | None) -> SessionUser:
    session = require_session(token)
    if session.role != Role.ADMIN:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)
    return session


def require_member(db: Session, token: str | None) -> SessionUser:
    session = require_session(token)
    if session.role != Role.USER:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)
    user = db.query(User).filter(User.id == session.id).first()
    if not user or not user.isActive:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)
    return session


def change_admin_password(
    db: Session, user_id: str, current_password: str, new_password: str
) -> None:
    user = db.query(User).filter(User.id == user_id, User.role == Role.ADMIN).first()
    if not user or not user.isActive:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)

    if not verify_password(current_password, user.passwordHash):
        raise ApiError("VALIDATION_ERROR", "현재 비밀번호가 올바르지 않습니다.")

    new_plain = new_password.strip()
    if not new_plain:
        raise ApiError("VALIDATION_ERROR", "새 비밀번호를 입력해 주세요.")
    if new_plain == current_password:
        raise ApiError("VALIDATION_ERROR", "새 비밀번호는 현재 비밀번호와 달라야 합니다.")

    user.passwordHash = hash_password(new_plain)
    db.commit()

