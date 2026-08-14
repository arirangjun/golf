from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import DbSession, active_user
from app.models import Role
from app.services.auth_service import SessionUser
from app.services.suggestion_service import (
    create_suggestion,
    delete_suggestion,
    list_suggestions,
    suggestion_to_dict,
)

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


class CreateSuggestionBody(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


@router.get("")
def get_suggestions(db: DbSession, session: SessionUser = Depends(active_user)):
    items = list_suggestions(db)
    is_admin = session.role == Role.ADMIN
    return {
        "suggestions": [suggestion_to_dict(item, session.id, is_admin) for item in items]
    }


@router.post("", status_code=201)
def post_suggestion(
    body: CreateSuggestionBody,
    db: DbSession,
    session: SessionUser = Depends(active_user),
):
    item = create_suggestion(db, session.id, body.content)
    return {"suggestion": suggestion_to_dict(item, session.id, False)}


@router.delete("")
def remove_suggestion(
    db: DbSession,
    id: str = Query(...),
    session: SessionUser = Depends(active_user),
):
    delete_suggestion(db, id, session.id, is_admin=session.role == Role.ADMIN)
    return {"ok": True}