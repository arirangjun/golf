from fastapi import APIRouter, Depends, Query

from app.dependencies import DbSession, member_user
from app.services.auth_service import SessionUser
from app.services.booking_rules import (
    format_booking_window_message,
    format_date,
    get_currently_bookable_week_range,
    get_next_booking_open_time,
    get_week_range,
    now_kst,
    parse_date_input,
)
from app.services.reservation_service import get_slots_for_date, get_slots_for_week

router = APIRouter(prefix="/slots", tags=["slots"])


@router.get("")
def slots_by_date(
    db: DbSession,
    date: str = Query(...),
    session: SessionUser = Depends(member_user),
):
    target = parse_date_input(date)
    slots = get_slots_for_date(db, target, session.id)
    return {"date": date, "slots": [slot.__dict__ for slot in slots]}


@router.get("/week")
def slots_by_week(
    db: DbSession,
    weekStart: str | None = Query(None),
    session: SessionUser = Depends(member_user),
):
    bookable = get_currently_bookable_week_range()
    if weekStart:
        week_start = parse_date_input(weekStart)
    elif bookable:
        week_start = bookable[0]
    else:
        week_start, _ = get_week_range(now_kst().date())

    days = get_slots_for_week(db, week_start, session.id)
    bookable_range = get_currently_bookable_week_range()
    next_open = get_next_booking_open_time()
    week_start_date, week_end_date = get_week_range(week_start)

    return {
        "weekStart": format_date(week_start_date),
        "weekEnd": format_date(week_end_date),
        "bookableWeekStart": format_date(bookable_range[0]) if bookable_range else None,
        "bookableWeekEnd": format_date(bookable_range[1]) if bookable_range else None,
        "nextBookingOpenAt": next_open.isoformat(),
        "bookingWindowMessage": format_booking_window_message(),
        "days": [{"date": day.date, "slots": [slot.__dict__ for slot in day.slots]} for day in days],
    }
