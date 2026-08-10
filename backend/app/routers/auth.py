from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr, Field

from app.dependencies import DbSession, SessionToken, admin_user, member_user
from app.services.auth_service import (
    SessionUser,
    authenticate_admin,
    authenticate_member,
    change_admin_password,
    clear_session_cookie,
    decode_token,
    set_session_cookie,
    to_session_user,
)
from app.services.member_service import change_member_password

router = APIRouter(prefix="/auth", tags=["auth"])


class MemberLoginBody(BaseModel):
    dong: str = Field(min_length=1)
    ho: str = Field(min_length=1)
    password: str = Field(min_length=1)
    loginType: str | None = None


class AdminLoginBody(BaseModel):
    loginType: str = "admin"
    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str


@router.post("/login")
def login(body: dict, response: Response, db: DbSession):
    if body.get("loginType") == "admin":
        parsed = AdminLoginBody.model_validate(body)
        user = authenticate_admin(db, parsed.email, parsed.password)
    else:
        parsed = MemberLoginBody.model_validate(body)
        user = authenticate_member(db, parsed.dong, parsed.ho, parsed.password)

    session_user = to_session_user(user)
    set_session_cookie(response, session_user)
    return {
        "user": {
            "id": session_user.id,
            "email": session_user.email,
            "name": session_user.name,
            "role": session_user.role.value,
        }
    }


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(token: SessionToken):
    if not token:
        return {"user": None}
    session = decode_token(token)
    if not session:
        return {"user": None}
    return {
        "user": {
            "id": session.id,
            "email": session.email,
            "name": session.name,
            "role": session.role.value,
        }
    }


class ChangePasswordBody(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=1)


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    db: DbSession,
    session: SessionUser = Depends(member_user),
):
    change_member_password(db, session.id, body.currentPassword, body.newPassword)
    return {"ok": True, "message": "비밀번호가 변경되었습니다."}


@router.post("/change-admin-password")
def change_admin_password_route(
    body: ChangePasswordBody,
    db: DbSession,
    session: SessionUser = Depends(admin_user),
):
    change_admin_password(db, session.id, body.currentPassword, body.newPassword)
    return {"ok": True, "message": "비밀번호가 변경되었습니다."}
