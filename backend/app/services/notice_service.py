from datetime import date

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import ApiError
from app.models import Notice, NoticeDismissal
from app.services.booking_rules import format_date, today_kst

TITLE_MAX = 191
CONTENT_MAX = 5000


def _validate(title: str, content: str, start: date, end: date) -> tuple[str, str]:
    title = title.strip()
    content = content.strip()
    if not title:
        raise ApiError("VALIDATION_ERROR", "공지 제목을 입력해 주세요.")
    if len(title) > TITLE_MAX:
        raise ApiError("VALIDATION_ERROR", f"공지 제목은 {TITLE_MAX}자까지 입력할 수 있습니다.")
    if not content:
        raise ApiError("VALIDATION_ERROR", "공지 내용을 입력해 주세요.")
    if len(content) > CONTENT_MAX:
        raise ApiError("VALIDATION_ERROR", f"공지 내용은 {CONTENT_MAX}자까지 입력할 수 있습니다.")
    if end < start:
        raise ApiError("VALIDATION_ERROR", "종료일은 시작일 이후여야 합니다.")
    return title, content


def list_notices(db: Session) -> list[Notice]:
    return db.query(Notice).order_by(Notice.startDate.desc(), Notice.createdAt.desc()).all()


def dismissal_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(NoticeDismissal.noticeId, func.count(NoticeDismissal.id))
        .group_by(NoticeDismissal.noticeId)
        .all()
    )
    return {notice_id: count for notice_id, count in rows}


def create_notice(db: Session, title: str, content: str, start: date, end: date) -> Notice:
    title, content = _validate(title, content, start, end)
    notice = Notice(title=title, content=content, startDate=start, endDate=end)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


def update_notice(
    db: Session, notice_id: str, title: str, content: str, start: date, end: date
) -> Notice:
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise ApiError("NOT_FOUND", "공지를 찾을 수 없습니다.", 404)
    title, content = _validate(title, content, start, end)
    notice.title = title
    notice.content = content
    notice.startDate = start
    notice.endDate = end
    db.commit()
    db.refresh(notice)
    return notice


def delete_notice(db: Session, notice_id: str) -> None:
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise ApiError("NOT_FOUND", "공지를 찾을 수 없습니다.", 404)
    db.query(NoticeDismissal).filter(NoticeDismissal.noticeId == notice_id).delete()
    db.delete(notice)
    db.commit()


def list_active_notices_for_user(db: Session, user_id: str) -> list[Notice]:
    today = today_kst()
    dismissed = db.query(NoticeDismissal.noticeId).filter(NoticeDismissal.userId == user_id)
    return (
        db.query(Notice)
        .filter(
            Notice.startDate <= today,
            Notice.endDate >= today,
            Notice.id.notin_(dismissed),
        )
        .order_by(Notice.startDate.desc(), Notice.createdAt.desc())
        .all()
    )


def dismiss_notice(db: Session, notice_id: str, user_id: str) -> None:
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise ApiError("NOT_FOUND", "공지를 찾을 수 없습니다.", 404)
    exists = (
        db.query(NoticeDismissal)
        .filter(NoticeDismissal.noticeId == notice_id, NoticeDismissal.userId == user_id)
        .first()
    )
    if exists:
        return
    db.add(NoticeDismissal(noticeId=notice_id, userId=user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def notice_status(notice: Notice) -> str:
    today = today_kst()
    if today < notice.startDate:
        return "SCHEDULED"
    if today > notice.endDate:
        return "ENDED"
    return "ACTIVE"


def notice_to_dict(notice: Notice, dismissed_count: int | None = None) -> dict:
    data = {
        "id": notice.id,
        "title": notice.title,
        "content": notice.content,
        "startDate": format_date(notice.startDate),
        "endDate": format_date(notice.endDate),
        "status": notice_status(notice),
        "createdAt": notice.createdAt.isoformat() if notice.createdAt else "",
    }
    if dismissed_count is not None:
        data["dismissedCount"] = dismissed_count
    return data
