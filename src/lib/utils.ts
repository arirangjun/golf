import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  addHours,
  addDays,
  isSameDay,
  format,
  previousSaturday,
  nextSaturday,
  isSaturday,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";
import { ko } from "date-fns/locale";
import { nowKST, parseDateKST, getReservationDateTimeKST, startOfDayKST } from "./kst";

/** Operating hours: 06:00 - 24:00 (weekday 09:00-10:00 cleaning) */
export const OPERATING_START_HOUR = 6;
export const OPERATING_END_HOUR = 24;
export const CLEANING_START_HOUR = 9;
export const CLEANING_END_HOUR = 10;
export const MAX_GROUP_SIZE = 3;
/** After 20:00, one bonus booking for the next day is allowed */
export const NEXT_DAY_BONUS_START_HOUR = 20;
export const CANCELLATION_HOURS_BEFORE = 3;
/** Member cancel: within grace minutes after booking, or before 22:00 day before */
export const CANCEL_GRACE_MINUTES = 10;
export const CANCEL_DEADLINE_HOUR_DAY_BEFORE = 22;
/** Weekend open hour: Saturday 14:00 (weekdays allow this+next week anytime) */
export const BOOKING_OPEN_HOUR = 14;

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }), // Monday
    end: endOfWeek(date, { weekStartsOn: 1 }), // Sunday
  };
}

function getSaturdayBookingOpenTime(saturday: Date): Date {
  return setMilliseconds(
    setSeconds(setMinutes(setHours(toDateOnly(saturday), BOOKING_OPEN_HOUR), 0), 0),
    0
  );
}

function isWeekdayKST(now: Date): boolean {
  const day = toDateOnly(now).getDay(); // 0=Sun … 6=Sat
  return day >= 1 && day <= 5;
}

/**
 * Bookable period:
 * - Weekdays (Mon–Fri): this week only (no Sat 14:00 wait)
 * - Weekend (Sat–Sun): week opened at the most recent Sat 14:00
 */
export function getCurrentlyBookableWeekRange(
  now: Date = nowKST()
): { start: Date; end: Date } | null {
  if (isWeekdayKST(now)) {
    return getWeekRange(toDateOnly(now));
  }

  let saturday = isSaturday(now) ? toDateOnly(now) : previousSaturday(now);
  let openTime = getSaturdayBookingOpenTime(saturday);

  if (now < openTime) {
    saturday = addDays(saturday, -7);
    openTime = getSaturdayBookingOpenTime(saturday);
  }

  const weekStart = addDays(saturday, 2);
  return getWeekRange(weekStart);
}

/** When the next booking window opens (next Sat 14:00, or today if not yet open) */
export function getNextBookingOpenTime(now: Date = nowKST()): Date {
  let saturday = isSaturday(now) ? toDateOnly(now) : nextSaturday(now);
  let openTime = getSaturdayBookingOpenTime(saturday);

  if (isSaturday(now) && now >= openTime) {
    saturday = addDays(saturday, 7);
    openTime = getSaturdayBookingOpenTime(saturday);
  }

  return openTime;
}

export function canBookDate(date: Date, now: Date = nowKST()): boolean {
  const range = getCurrentlyBookableWeekRange(now);
  if (!range) return false;

  const dateOnly = toDateOnly(date);
  return dateOnly >= range.start && dateOnly <= range.end;
}

export function formatBookingWindowMessage(now: Date = nowKST()): string {
  const range = getCurrentlyBookableWeekRange(now);
  if (!range) {
    const nextOpen = getNextBookingOpenTime(now);
    return `예약 오픈: ${format(nextOpen, "M월 d일 (EEE) HH:mm", { locale: ko })}부터`;
  }

  if (isWeekdayKST(now)) {
    return `예약 가능: ${format(range.start, "M/d", { locale: ko })} ~ ${format(range.end, "M/d", { locale: ko })} (주중에는 이번 주 언제든 예약 가능)`;
  }
  return `예약 가능 주간: ${format(range.start, "M/d", { locale: ko })} ~ ${format(range.end, "M/d", { locale: ko })} (주말: 토요일 ${BOOKING_OPEN_HOUR}:00 오픈)`;
}

export function toDateOnly(date: Date): Date {
  return startOfDay(date);
}

export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDateKo(date: Date): string {
  return format(date, "M월 d일 (EEE)", { locale: ko });
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** 회원 초기 비밀번호 */
export const DEFAULT_MEMBER_PASSWORD = "1";

export function formatUnit(dong: string, ho: string): string {
  const d = dong.trim();
  const h = ho.trim();
  if (!d && !h) return "";
  const dongLabel = d.endsWith("동") ? d : `${d}동`;
  return h ? `${dongLabel} ${h}호` : dongLabel;
}

export function generateMemberEmail(dong: string, ho: string): string {
  return `${dong.trim()}-${ho.trim()}@member.golf`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = normalizePhone(phone);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** 이름 중간 글자 마스킹 (예: 홍길동 → 홍*동) */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  if (trimmed.length === 3) return `${trimmed[0]}*${trimmed[2]}`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

/** 동 + 마스킹된 이름 (예: 101동 홍*동) */
export function formatMemberDisplay(dong: string, name: string): string {
  if (!dong.trim()) return maskName(name);
  const dongLabel = dong.trim().endsWith("동") ? dong.trim() : `${dong.trim()}동`;
  return `${dongLabel} ${maskName(name)}`;
}

export function getOperatingHours(): number[] {
  return getAllDayHours().filter((h) => isOperatingHour(h));
}

/** Grid hours: 06:00 ~ 23:00 (includes cleaning slot for display) */
export function getAllDayHours(): number[] {
  const hours: number[] = [];
  for (let h = OPERATING_START_HOUR; h < OPERATING_END_HOUR; h++) {
    hours.push(h);
  }
  return hours;
}

export function isWeekend(date?: Date | string | null): boolean {
  if (!date) return false;
  const day = (typeof date === "string" ? parseDateInput(date) : toDateOnly(date)).getDay();
  return day === 0 || day === 6;
}

export function isCleaningHour(hour: number, date?: Date | string | null): boolean {
  // 주말에는 청소시간 없음. 법정공휴일은 서버 슬롯 API가 최종 판정.
  if (isWeekend(date)) return false;
  return hour >= CLEANING_START_HOUR && hour < CLEANING_END_HOUR;
}

export function isOperatingHour(hour: number, date?: Date | string | null): boolean {
  return (
    hour >= OPERATING_START_HOUR &&
    hour < OPERATING_END_HOUR &&
    !isCleaningHour(hour, date)
  );
}

export function getReservationDateTime(date: Date, startHour: number): Date {
  return getReservationDateTimeKST(date, startHour);
}

export function canCancelReservation(
  reservationDate: Date,
  startHour: number,
  createdAt?: Date | string | null,
  now: Date = nowKST()
): boolean {
  // 1) 예약 직후 10분: 슬롯 날짜·시간과 무관
  if (createdAt) {
    const graceMs = CANCEL_GRACE_MINUTES * 60 * 1000;
    const skewMs = 120 * 1000;
    const candidates: Date[] = [];
    if (createdAt instanceof Date) {
      candidates.push(createdAt);
    } else {
      const raw = createdAt.trim();
      if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
        candidates.push(new Date(raw));
      } else {
        candidates.push(new Date(`${raw}+09:00`));
        candidates.push(new Date(`${raw}Z`));
      }
    }
    for (const created of candidates) {
      if (Number.isNaN(created.getTime())) continue;
      const elapsed = now.getTime() - created.getTime();
      if (elapsed >= -skewMs && elapsed <= graceMs) return true;
    }
  }

  // 2) 예약 전날 22:00 이전
  const resDay = toDateOnly(reservationDate);
  const dayBefore = addDays(resDay, -1);
  const deadline = new Date(dayBefore);
  deadline.setHours(CANCEL_DEADLINE_HOUR_DAY_BEFORE, 0, 0, 0);
  return now.getTime() < deadline.getTime();
}

export function cancelBlockedReason(
  reservationDate: Date,
  startHour: number,
  createdAt?: Date | string | null,
  now: Date = nowKST()
): string {
  if (canCancelReservation(reservationDate, startHour, createdAt, now)) {
    return "";
  }
  return `취소할 수 없습니다. 예약 후 ${CANCEL_GRACE_MINUTES}분 이내(시간 무관), 또는 예약 전날 ${String(CANCEL_DEADLINE_HOUR_DAY_BEFORE).padStart(2, "0")}:00 이전까지 취소할 수 있습니다.`;
}

export function isNextDayBonusBookingAllowed(
  targetDate: Date,
  now: Date = nowKST()
): boolean {
  if (now.getHours() < NEXT_DAY_BONUS_START_HOUR) return false;
  const tomorrow = addDays(startOfDayKST(now), 1);
  return isSameDay(targetDate, tomorrow);
}

/** 당일(오늘) 빈 슬롯 추가 예약 대상 */
export function isSameDayExtraBookingAllowed(
  targetDate: Date,
  now: Date = nowKST()
): boolean {
  return isSameDay(toDateOnly(targetDate), toDateOnly(now));
}

export function parseDateInput(dateStr: string): Date {
  return parseDateKST(dateStr);
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SLOT_TAKEN"
  | "WEEKLY_LIMIT"
  | "BONUS_LIMIT"
  | "CANCEL_TOO_LATE"
  | "BOOKING_NOT_OPEN"
  | "USER_INACTIVE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
      { status: 401 }
    );
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." } },
      { status: 403 }
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
    { status: 500 }
  );
}
