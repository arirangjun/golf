from sqlalchemy.orm import Session, joinedload

from app.exceptions import ApiError
from app.models import Role, Suggestion, User
from app.services.formatting import format_unit


def list_suggestions(db: Session, limit: int = 100) -> list[Suggestion]:
    return (
        db.query(Suggestion)
        .options(joinedload(Suggestion.user))
        .order_by(Suggestion.createdAt.desc())
        .limit(limit)
        .all()
    )


def create_suggestion(db: Session, user_id: str, content: str) -> Suggestion:
    text = content.strip()
    if not text:
        raise ApiError("VALIDATION_ERROR", "건의 내용을 입력해 주세요.")
    if len(text) > 1000:
        raise ApiError("VALIDATION_ERROR", "건의는 1000자까지 입력할 수 있습니다.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.isActive:
        raise ApiError("FORBIDDEN", "접근 권한이 없습니다.", 403)

    item = Suggestion(userId=user_id, content=text)
    db.add(item)
    db.commit()
    db.refresh(item)
    item.user = user
    return item


def delete_suggestion(db: Session, suggestion_id: str, actor_id: str, is_admin: bool) -> None:
    item = db.query(Suggestion).filter(Suggestion.id == suggestion_id).first()
    if not item:
        raise ApiError("NOT_FOUND", "건의를 찾을 수 없습니다.", 404)
    if not is_admin and item.userId != actor_id:
        raise ApiError("FORBIDDEN", "본인 건의만 삭제할 수 있습니다.", 403)
    db.delete(item)
    db.commit()


def suggestion_to_dict(item: Suggestion, current_user_id: str, is_admin: bool) -> dict:
    user = item.user
    return {
        "id": item.id,
        "content": item.content,
        "createdAt": item.createdAt.isoformat() if item.createdAt else "",
        "authorName": user.name if user else "",
        "unitLabel": format_unit(user.dong, user.ho) if user else "",
        "isMine": item.userId == current_user_id,
        "canDelete": is_admin or item.userId == current_user_id,
    }


def is_admin_role(role: Role | str) -> bool:
    return role == Role.ADMIN or role == "ADMIN"