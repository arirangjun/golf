from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import DbSession, admin_user, member_user
from app.services.auth_service import SessionUser
from app.services.vote_service import cast_vote, vote_status

router = APIRouter(prefix="/votes", tags=["votes"])


class CastVoteBody(BaseModel):
    choice: str = Field(pattern=r"^(AGREE|DISAGREE|UNSURE)$")


@router.get("/app-intro")
def get_app_intro_vote(db: DbSession, session: SessionUser = Depends(member_user)):
    return vote_status(db, session.id)


@router.post("/app-intro")
def post_app_intro_vote(
    body: CastVoteBody,
    db: DbSession,
    session: SessionUser = Depends(member_user),
):
    return cast_vote(db, session.id, body.choice)


@router.get("/app-intro/admin")
def get_app_intro_vote_admin(db: DbSession, _admin: SessionUser = Depends(admin_user)):
    return vote_status(db)
