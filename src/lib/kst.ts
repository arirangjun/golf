import {
  addHours,
  format,
  isBefore,
  startOfDay,
  subDays,
} from "date-fns";
import { TZDate } from "@date-fns/tz";

export const KST_TIMEZONE = "Asia/Seoul";

/** 현재 한국 시간 */
export function nowKST(): TZDate {
  return TZDate.tz(KST_TIMEZONE);
}

/** 오늘 날짜 (한국 기준) */
export function todayKST(): TZDate {
  const now = nowKST();
  return new TZDate(now.getFullYear(), now.getMonth(), now.getDate(), KST_TIMEZONE);
}

/** YYYY-MM-DD 문자열 → 한국 자정 */
export function parseDateKST(dateStr: string): TZDate {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new TZDate(year, month - 1, day, 0, 0, 0, KST_TIMEZONE);
}

/** 날짜 + 시간 → 한국 로컬 DateTime */
export function getSlotDateTimeKST(dateStr: string, hour: number): TZDate {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new TZDate(year, month - 1, day, hour, 0, 0, KST_TIMEZONE);
}

/** 슬롯이 한국 시간 기준으로 이미 지났는지 */
export function isPastSlotKST(dateStr: string, hour: number): boolean {
  const slotTime = getSlotDateTimeKST(dateStr, hour);
  return isBefore(slotTime, nowKST());
}

/** 한국 오늘 기준 N일 전 날짜 문자열 */
export function formatDateKST(date: Date, pattern = "yyyy-MM-dd"): string {
  return format(date, pattern);
}

export function defaultStatsRangeKST(): { from: string; to: string; month: string } {
  const today = todayKST();
  return {
    from: formatDateKST(subDays(today, 30)),
    to: formatDateKST(today),
    month: formatDateKST(today, "yyyy-MM"),
  };
}

/** Date를 KST 기준으로 해석 (naive Date도 한국 날짜로 취급) */
export function toKST(date: Date): TZDate {
  return new TZDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
    KST_TIMEZONE
  );
}

/** KST 자정 */
export function startOfDayKST(date: Date): TZDate {
  const kst = toKST(date);
  return new TZDate(kst.getFullYear(), kst.getMonth(), kst.getDate(), KST_TIMEZONE);
}

/** 예약 시각 (한국) */
export function getReservationDateTimeKST(reservationDate: Date, startHour: number): TZDate {
  const day = startOfDayKST(reservationDate);
  return addHours(day, startHour) as TZDate;
}
