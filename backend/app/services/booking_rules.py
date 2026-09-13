from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

OPERATING_START_HOUR = 6
OPERATING_END_HOUR = 24
CLEANING_START_HOUR = 9
CLEANING_END_HOUR = 10
NEXT_DAY_BONUS_START_HOUR = 20
CANCELLATION_HOURS_BEFORE = 3  # legacy reference; member cancel uses grace + day-before deadline
CANCEL_GRACE_MINUTES = 10
CANCEL_DEADLINE_HOUR_DAY_BEFORE = 22  # 예약 전날 이 시각 이전까지 취소 가능
BOOKING_OPEN_HOUR = 14
MAX_GROUP_SIZE = 6
DEFAULT_MEMBER_PASSWORD = "1"
RESERVATION_RETENTION_DAYS = 365

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


def retention_cutoff(now: date | datetime | None = None) -> date:
    """예약 조회·보관 하한일 (이 날짜 미만은 삭제 대상)."""
    if now is None:
        base = today_kst()
    elif isinstance(now, datetime):
        base = to_date_only(now)
    else:
        base = now
    return base - timedelta(days=RESERVATION_RETENTION_DAYS)


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

    - 주중(월~금): 이번 주(월~일) 상시 예약 가능
    - 주말(토~일): 기존처럼 가장 최근 토요일 14:00에 열린 주간만 가능
    """
    current = now or now_kst()
    today = current.date()

    # Mon=0 … Fri=4 — 이번 주만
    if today.weekday() < WEEKDAY_SATURDAY:
        return get_week_range(today)

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
            f"(주중에는 이번 주 언제든 예약 가능)"
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
    return list(range(OPERATING_START_HOUR, OPERATING_END_HOUR))


def is_weekend(value: date | datetime | None) -> bool:
    if value is None:
        return False
    return to_date_only(value).weekday() >= 5


def is_cleaning_hour(hour: int, target: date | datetime | None = None) -> bool:
    if is_weekend(target):
        return False
    return CLEANING_START_HOUR <= hour < CLEANING_END_HOUR


def is_operating_hour(hour: int, target: date | datetime | None = None) -> bool:
    return OPERATING_START_HOUR <= hour < OPERATING_END_HOUR and not is_cleaning_hour(hour, target)


def get_reservation_datetime(reservation_date: date | datetime, start_hour: int) -> datetime:
    d = to_date_only(reservation_date)
    return datetime(d.year, d.month, d.day, start_hour, 0, 0, tzinfo=KST)


def is_within_cancel_grace(
    created_at: datetime | None, now: datetime | None = None
) -> bool:
    """예약 직후 CANCEL_GRACE_MINUTES 이내인지 (예약 슬롯 일시와 무관).

    DB naive datetime이 KST 또는 UTC로 저장된 경우 모두 허용한다.
    """
    if created_at is None:
        return False

    current = now or now_kst()
    grace = CANCEL_GRACE_MINUTES * 60
    # 서버/클라이언트 시계 오차 여유
    skew = 120

    candidates: list[datetime] = []
    if created_at.tzinfo is None:
        candidates.append(created_at.replace(tzinfo=KST))
        candidates.append(created_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(KST))
    else:
        candidates.append(created_at.astimezone(KST))

    for created in candidates:
        elapsed = (current - created).total_seconds()
        if -skew <= elapsed <= grace:
            return True
    return False


def can_cancel_reservation(
    reservation_date: date | datetime,
    start_hour: int,
    created_at: datetime | None = None,
    now: datetime | None = None,
) -> bool:
    """회원 취소 가능 여부.

    - 예약 직후 CANCEL_GRACE_MINUTES 이내(슬롯 날짜·시간과 무관), 또는
    - 예약 전날 CANCEL_DEADLINE_HOUR_DAY_BEFORE 시 이전
    """
    current = now or now_kst()

    # 1) 예약 직후 유예: 당일/과거/미래 슬롯 모두 무조건 허용
    if is_within_cancel_grace(created_at, current):
        return True

    # 2) 예약 전날 22:00 이전
    res_date = to_date_only(reservation_date)
    day_before = res_date - timedelta(days=1)
    deadline = datetime(
        day_before.year,
        day_before.month,
        day_before.day,
        CANCEL_DEADLINE_HOUR_DAY_BEFORE,
        0,
        0,
        tzinfo=KST,
    )
    return current < deadline


def cancel_blocked_reason(
    reservation_date: date | datetime,
    start_hour: int,
    created_at: datetime | None = None,
    now: datetime | None = None,
) -> str:
    """취소 불가 시 사용자 안내 문구."""
    if can_cancel_reservation(reservation_date, start_hour, created_at, now):
        return ""
    return (
        f"취소할 수 없습니다. "
        f"예약 후 {CANCEL_GRACE_MINUTES}분 이내(시간 무관), 또는 예약 전날 "
        f"{CANCEL_DEADLINE_HOUR_DAY_BEFORE}:00 이전까지 취소할 수 있습니다."
    )


def is_next_day_bonus_booking_allowed(
    target: date | datetime, now: datetime | None = None
) -> bool:
    current = now or now_kst()
    if current.hour < NEXT_DAY_BONUS_START_HOUR:
        return False
    tomorrow = current.date() + timedelta(days=1)
    return to_date_only(target) == tomorrow


def is_same_day_extra_booking_allowed(
    target: date | datetime, now: datetime | None = None
) -> bool:
    """당일 빈 슬롯 추가 예약 대상인지 (오늘 날짜)."""
    current = now or now_kst()
    return to_date_only(target) == current.date()


def date_to_datetime(d: date) -> datetime:
    """MySQL 저장용 naive datetime (KST wall clock 자정)."""
    return datetime(d.year, d.month, d.day, 0, 0, 0)
