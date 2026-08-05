from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.services.auth_service import SessionUser, require_admin, require_member


def get_session_token(
    golf_session: Annotated[str | None, Cookie(alias=settings.cookie_name)] = None,
) -> str | None:
    return golf_session


DbSession = Annotated[Session, Depends(get_db)]
SessionToken = Annotated[str | None, Depends(get_session_token)]


def member_user(db: DbSession, token: SessionToken) -> SessionUser:
    return require_member(db, token)


def admin_user(db: DbSession, token: SessionToken) -> SessionUser:
    return require_admin(db, token)
