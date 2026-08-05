from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import DbSession, member_user
from app.services.auth_service import SessionUser
from app.services.booking_rules import can_cancel_reservation, format_date, format_hour, parse_date_input
from app.services.reservation_service import (
    cancel_reservation,
    create_reservation,
    get_user_reservations,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])


class CreateReservationBody(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    startHour: int = Field(ge=0, le=23)


@router.get("")
def list_reservations(db: DbSession, session: SessionUser = Depends(member_user)):
    reservations = get_user_reservations(db, session.id)
    return {
        "reservations": [
            {
                "id": r.id,
                "date": format_date(r.date),
                "startHour": r.startHour,
                "endHour": r.endHour,
                "isSameDayBooking": r.isSameDayBooking,
                "canCancel": can_cancel_reservation(r.date, r.startHour),
                "timeLabel": f"{format_hour(r.startHour)} - {format_hour(r.endHour)}",
            }
            for r in reservations
        ]
    }


@router.post("", status_code=201)
def create(body: CreateReservationBody, db: DbSession, session: SessionUser = Depends(member_user)):
    result = create_reservation(
        db,
        user_id=session.id,
        target=parse_date_input(body.date),
        start_hour=body.startHour,
    )
    return result


@router.delete("")
def delete_reservation(
    db: DbSession,
    id: str = Query(...),
    session: SessionUser = Depends(member_user),
):
    cancel_reservation(db, id, session.id, is_admin=False)
    return {"ok": True}
