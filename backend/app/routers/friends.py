from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import DbSession, member_user
from app.services.auth_service import SessionUser
from app.services.friend_service import add_friend, list_friends, remove_friend, search_members

router = APIRouter(prefix="/friends", tags=["friends"])


class AddFriendBody(BaseModel):
    friendId: str = Field(min_length=1)


@router.get("")
def get_friends(db: DbSession, session: SessionUser = Depends(member_user)):
    return {"friends": list_friends(db, session.id)}


@router.get("/search")
def search_friends(
    db: DbSession,
    session: SessionUser = Depends(member_user),
    dong: str = Query(""),
    ho: str = Query(""),
    name: str = Query(""),
):
    return {"users": search_members(db, session.id, dong, ho, name)}


@router.post("", status_code=201)
def create_friend(
    body: AddFriendBody,
    db: DbSession,
    session: SessionUser = Depends(member_user),
):
    return {"friend": add_friend(db, session.id, body.friendId)}


@router.delete("")
def delete_friend(
    db: DbSession,
    id: str = Query(...),
    session: SessionUser = Depends(member_user),
):
    remove_friend(db, session.id, id)
    return {"ok": True}
