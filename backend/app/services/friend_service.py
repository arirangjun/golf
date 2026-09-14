from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.exceptions import ApiError
from app.models import Friendship, Role, User
from app.services.formatting import format_member_display, format_unit


def _norm_unit(value: str, suffix: str) -> str:
    v = value.strip()
    if v.endswith(suffix):
        v = v[: -len(suffix)].strip()
    return v


def _active_member_query(db: Session):
    return db.query(User).filter(
        User.role == Role.USER,
        User.isActive.is_(True),
        User.deletedAt.is_(None),
    )


def _friend_dict(friendship: Friendship, friend: User) -> dict:
    return {
        "id": friendship.id,
        "friendUserId": friend.id,
        "name": friend.name,
        "dong": friend.dong,
        "ho": friend.ho,
        "unitLabel": format_unit(friend.dong, friend.ho),
        "displayName": format_member_display(friend.dong, friend.name),
    }


def list_friends(db: Session, user_id: str) -> list[dict]:
    rows = (
        db.query(Friendship)
        .options(joinedload(Friendship.friend))
        .filter(Friendship.userId == user_id)
        .order_by(Friendship.createdAt.asc())
        .all()
    )
    return [_friend_dict(row, row.friend) for row in rows if row.friend and row.friend.deletedAt is None]


def search_members(
    db: Session,
    user_id: str,
    dong: str = "",
    ho: str = "",
    name: str = "",
) -> list[dict]:
    dong_key = _norm_unit(dong, "동")
    ho_key = _norm_unit(ho, "호")
    if not dong_key or not ho_key:
        raise ApiError("VALIDATION_ERROR", "동과 호수를 입력해 주세요.")

    query = _active_member_query(db).filter(User.id != user_id)
    query = query.filter(
        or_(User.dong == dong_key, User.dong == f"{dong_key}동", User.dong.contains(dong_key))
    )
    query = query.filter(
        or_(User.ho == ho_key, User.ho == f"{ho_key}호", User.ho.contains(ho_key))
    )

    users = query.order_by(User.dong.asc(), User.ho.asc(), User.name.asc()).limit(20).all()
    existing = {
        row.friendId
        for row in db.query(Friendship.friendId).filter(Friendship.userId == user_id).all()
    }
    return [
        {
            "id": user.id,
            "name": user.name,
            "dong": user.dong,
            "ho": user.ho,
            "unitLabel": format_unit(user.dong, user.ho),
            "displayName": format_member_display(user.dong, user.name),
            "alreadyFriend": user.id in existing,
        }
        for user in users
    ]


def add_friend(db: Session, user_id: str, friend_id: str) -> dict:
    if friend_id == user_id:
        raise ApiError("VALIDATION_ERROR", "자기 자신은 친구로 추가할 수 없습니다.")

    friend = _active_member_query(db).filter(User.id == friend_id).first()
    if not friend:
        raise ApiError("NOT_FOUND", "추가할 회원을 찾을 수 없습니다.", 404)

    existing = (
        db.query(Friendship)
        .filter(Friendship.userId == user_id, Friendship.friendId == friend_id)
        .first()
    )
    if existing:
        raise ApiError("VALIDATION_ERROR", "이미 추가된 친구입니다.")

    try:
        friendship = Friendship(userId=user_id, friendId=friend_id)
        db.add(friendship)
        db.commit()
        db.refresh(friendship)
        return _friend_dict(friendship, friend)
    except IntegrityError:
        db.rollback()
        raise ApiError("VALIDATION_ERROR", "이미 추가된 친구입니다.")


def remove_friend(db: Session, user_id: str, friendship_id: str) -> None:
    friendship = (
        db.query(Friendship)
        .filter(Friendship.id == friendship_id, Friendship.userId == user_id)
        .first()
    )
    if not friendship:
        raise ApiError("NOT_FOUND", "친구를 찾을 수 없습니다.", 404)
    db.delete(friendship)
    db.commit()


def assert_are_friends(db: Session, user_id: str, friend_ids: list[str]) -> list[User]:
    if not friend_ids:
        return []
    unique_ids = list(dict.fromkeys(friend_ids))
    rows = (
        db.query(Friendship)
        .filter(Friendship.userId == user_id, Friendship.friendId.in_(unique_ids))
        .all()
    )
    found = {row.friendId for row in rows}
    missing = [fid for fid in unique_ids if fid not in found]
    if missing:
        raise ApiError("VALIDATION_ERROR", "친구로 추가된 회원만 단체 예약할 수 있습니다.")

    users = _active_member_query(db).filter(User.id.in_(unique_ids)).all()
    user_map = {user.id: user for user in users}
    if len(user_map) != len(unique_ids):
        raise ApiError("VALIDATION_ERROR", "비활성 또는 삭제된 회원은 단체 예약할 수 없습니다.")
    return [user_map[fid] for fid in unique_ids]
