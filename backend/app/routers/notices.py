from fastapi import APIRouter, Depends

from app.dependencies import DbSession, member_user
from app.services.auth_service import SessionUser
from app.services.notice_service import (
    dismiss_notice,
    list_active_notices_for_user,
    notice_to_dict,
)

router = APIRouter(prefix="/notices", tags=["notices"])


@router.get("/active")
def get_active_notices(db: DbSession, session: SessionUser = Depends(member_user)):
    items = list_active_notices_for_user(db, session.id)
    return {"notices": [notice_to_dict(item) for item in items]}


@router.post("/{notice_id}/dismiss")
def post_dismiss_notice(
    notice_id: str,
    db: DbSession,
    session: SessionUser = Depends(member_user),
):
    dismiss_notice(db, notice_id, session.id)
    return {"ok": True}
