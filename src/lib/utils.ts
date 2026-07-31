import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  addHours,
  addDays,
  isSameDay,
  format,
} from "date-fns";
import { ko } from "date-fns/locale";

/** Operating hours: 00:00 - 24:00 (24 slots) */
export const OPERATING_START_HOUR = 0;
export const OPERATING_END_HOUR = 24;
/** After 21:00, one bonus booking for the next day is allowed */
export const NEXT_DAY_BONUS_START_HOUR = 21;
export const CANCELLATION_HOURS_BEFORE = 3;

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }), // Monday
    end: endOfWeek(date, { weekStartsOn: 1 }), // Sunday
  };
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
  const hours: number[] = [];
  for (let h = OPERATING_START_HOUR; h < OPERATING_END_HOUR; h++) {
    hours.push(h);
  }
  return hours;
}

/** Full day grid: 00:00 ~ 23:00 (24 one-hour cells) */
export function getAllDayHours(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

export function isOperatingHour(hour: number): boolean {
  return hour >= OPERATING_START_HOUR && hour < OPERATING_END_HOUR;
}

export function getReservationDateTime(date: Date, startHour: number): Date {
  return addHours(startOfDay(date), startHour);
}

export function canCancelReservation(
  reservationDate: Date,
  startHour: number,
  now: Date = new Date()
): boolean {
  const reservationTime = getReservationDateTime(reservationDate, startHour);
  const diffMs = reservationTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= CANCELLATION_HOURS_BEFORE;
}

export function isNextDayBonusBookingAllowed(
  targetDate: Date,
  now: Date = new Date()
): boolean {
  if (now.getHours() < NEXT_DAY_BONUS_START_HOUR) return false;
  const tomorrow = addDays(startOfDay(now), 1);
  return isSameDay(targetDate, tomorrow);
}

export function parseDateInput(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
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
