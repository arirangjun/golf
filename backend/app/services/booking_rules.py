from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

OPERATING_START_HOUR = 0
OPERATING_END_HOUR = 24
NEXT_DAY_BONUS_START_HOUR = 21
CANCELLATION_HOURS_BEFORE = 3
BOOKING_OPEN_HOUR = 14
DEFAULT_MEMBER_PASSWORD = "1"

WEEKDAY_SATURDAY = 5


def ensure_kst(value: datetime) -> datetime:
    """DB naive datetime 포함, 항상 KST aware datetime으로 변환."""
    if value.tzinfo is None:
        return value.replace(tzinfo=KST)
    return value.astimezone(KST)


def now_kst() -> datetime:
    return datetime.now(KST)


def today_kst() -> date:
    return now_kst().date()


def to_date_only(value: date | datetime) -> date:
    if isinstance(value, datetime):
        return ensure_kst(value).date()
    return value


def get_week_range(value: date | datetime) -> tuple[date, date]:
    d = to_date_only(value)
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _saturday_open_time(saturday: date) -> datetime:
    return datetime(
        saturday.year, saturday.month, saturday.day, BOOKING_OPEN_HOUR, 0, 0, tzinfo=KST
    )


def _previous_saturday(value: date) -> date:
    days_back = (value.weekday() - WEEKDAY_SATURDAY) % 7
    if days_back == 0:
        return value
    return value - timedelta(days=days_back)


def _next_saturday(value: date) -> date:
    days_ahead = (WEEKDAY_SATURDAY - value.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return value + timedelta(days=days_ahead)


def get_currently_bookable_week_range(
    now: datetime | None = None,
) -> tuple[date, date] | None:
    """예약 가능 기간.

    - 주중(월~금): 이번 주(월~일) + 다음 주(월~일) 상시 예약 가능
    - 주말(토~일): 기존처럼 가장 최근 토요일 14:00에 열린 주간만 가능
    """
    current = now or now_kst()
    today = current.date()

    # Mon=0 … Fri=4
    if today.weekday() < WEEKDAY_SATURDAY:
        this_monday, _ = get_week_range(today)
        next_sunday = this_monday + timedelta(days=13)
        return this_monday, next_sunday

    saturday = today if today.weekday() == WEEKDAY_SATURDAY else _previous_saturday(today)
    open_time = _saturday_open_time(saturday)

    if current < open_time:
        saturday = saturday - timedelta(days=7)

    week_start = saturday + timedelta(days=2)
    return get_week_range(week_start)


def get_next_booking_open_time(now: datetime | None = None) -> datetime:
    current = now or now_kst()
    today = current.date()

    saturday = today if today.weekday() == WEEKDAY_SATURDAY else _next_saturday(today)
    open_time = _saturday_open_time(saturday)

    if today.weekday() == WEEKDAY_SATURDAY and current >= open_time:
        saturday = saturday + timedelta(days=7)
        open_time = _saturday_open_time(saturday)

    return open_time


def can_book_date(target: date | datetime, now: datetime | None = None) -> bool:
    bookable = get_currently_bookable_week_range(now)
    if not bookable:
        return False
    target_date = to_date_only(target)
    return bookable[0] <= target_date <= bookable[1]


def format_booking_window_message(now: datetime | None = None) -> str:
    current = now or now_kst()
    bookable = get_currently_bookable_week_range(current)
    if not bookable:
        next_open = get_next_booking_open_time(current)
        weekdays = ["월", "화", "수", "목", "금", "토", "일"]
        wd = weekdays[next_open.weekday()]
        return f"예약 오픈: {next_open.month}월 {next_open.day}일 ({wd}) {next_open.strftime('%H:%M')}부터"

    start, end = bookable
    if current.date().weekday() < WEEKDAY_SATURDAY:
        return (
            f"예약 가능: {start.month}/{start.day} ~ {end.month}/{end.day} "
            f"(주중에는 이번 주·다음 주 언제든 예약 가능)"
        )
    return (
        f"예약 가능 주간: {start.month}/{start.day} ~ {end.month}/{end.day} "
        f"(주말: 토요일 {BOOKING_OPEN_HOUR}:00 오픈)"
    )


def format_date(value: date | datetime) -> str:
    d = to_date_only(value)
    return d.strftime("%Y-%m-%d")


def format_hour(hour: int) -> str:
    return f"{hour:02d}:00"


def parse_date_input(date_str: str) -> date:
    year, month, day = map(int, date_str.split("-"))
    return date(year, month, day)


def get_all_day_hours() -> list[int]:
    return list(range(24))


def is_operating_hour(hour: int) -> bool:
    return OPERATING_START_HOUR <= hour < OPERATING_END_HOUR


def get_reservation_datetime(reservation_date: date | datetime, start_hour: int) -> datetime:
    d = to_date_only(reservation_date)
    return datetime(d.year, d.month, d.day, start_hour, 0, 0, tzinfo=KST)


def can_cancel_reservation(
    reservation_date: date | datetime, start_hour: int, now: datetime | None = None
) -> bool:
    current = now or now_kst()
    reservation_time = get_reservation_datetime(reservation_date, start_hour)
    diff_hours = (reservation_time - current).total_seconds() / 3600
    return diff_hours >= CANCELLATION_HOURS_BEFORE


def is_next_day_bonus_booking_allowed(
    target: date | datetime, now: datetime | None = None
) -> bool:
    current = now or now_kst()
    if current.hour < NEXT_DAY_BONUS_START_HOUR:
        return False
    tomorrow = current.date() + timedelta(days=1)
    return to_date_only(target) == tomorrow


def date_to_datetime(d: date) -> datetime:
    """MySQL 저장용 naive datetime (KST wall clock 자정)."""
    return datetime(d.year, d.month, d.day, 0, 0, 0)
