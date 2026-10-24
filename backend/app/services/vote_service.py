from datetime import date

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import ApiError
from app.models import AppIntroVote, Role, User, VoteChoice
from app.services.booking_rules import today_kst

VOTE_START = date(2026, 10, 24)
VOTE_END = date(2026, 10, 29)

CHOICES = {
    "AGREE": VoteChoice.AGREE,
    "DISAGREE": VoteChoice.DISAGREE,
    "UNSURE": VoteChoice.UNSURE,
}


def is_vote_open(today: date | None = None) -> bool:
    current = today or today_kst()
    return VOTE_START <= current <= VOTE_END


def vote_results(db: Session) -> dict:
    rows = db.query(AppIntroVote.choice, func.count(AppIntroVote.id)).group_by(AppIntroVote.choice).all()
    counts = {VoteChoice.AGREE: 0, VoteChoice.DISAGREE: 0, VoteChoice.UNSURE: 0}
    for choice, count in rows:
        counts[choice] = int(count)
    return {
        "agree": counts[VoteChoice.AGREE],
        "disagree": counts[VoteChoice.DISAGREE],
        "unsure": counts[VoteChoice.UNSURE],
        "total": sum(counts.values()),
    }


def vote_status(db: Session, user_id: str | None = None) -> dict:
    vote = None
    if user_id:
        vote = db.query(AppIntroVote).filter(AppIntroVote.userId == user_id).first()
    active_members = (
        db.query(User)
        .filter(User.role == Role.USER, User.isActive.is_(True), User.deletedAt.is_(None))
        .count()
    )
    return {
        "open": is_vote_open(),
        "startDate": VOTE_START.isoformat(),
        "endDate": VOTE_END.isoformat(),
        "voted": vote is not None,
        "myChoice": vote.choice.value if vote else None,
        "activeMembers": int(active_members),
        "results": vote_results(db),
    }


def cast_vote(db: Session, user_id: str, choice: str) -> dict:
    if not is_vote_open():
        raise ApiError("VOTE_CLOSED", "투표 기간이 아닙니다.")
    parsed = CHOICES.get(choice)
    if parsed is None:
        raise ApiError("VALIDATION_ERROR", "투표 항목을 선택해 주세요.")
    existing = db.query(AppIntroVote).filter(AppIntroVote.userId == user_id).first()
    if existing:
        raise ApiError("ALREADY_VOTED", "이미 투표하셨습니다. 회원당 1회만 참여할 수 있습니다.")

    db.add(AppIntroVote(userId=user_id, choice=parsed))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError("ALREADY_VOTED", "이미 투표하셨습니다. 회원당 1회만 참여할 수 있습니다.")
    return vote_status(db, user_id)
