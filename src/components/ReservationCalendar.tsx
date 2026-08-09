"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { ko } from "date-fns/locale";
import { isPastSlotKST } from "@/lib/kst";

interface Slot {
  startHour: number;
  endHour: number;
  available: boolean;
  isOperating: boolean;
  bookable?: boolean;
  reservationId?: string;
  displayLabel?: string;
  isMine?: boolean;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface Reservation {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  isSameDayBooking: boolean;
  canCancel: boolean;
  timeLabel: string;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function isPastSlot(dateStr: string, hour: number): boolean {
  return isPastSlotKST(dateStr, hour);
}

export function ReservationCalendar() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);
  const [bookingWindowMessage, setBookingWindowMessage] = useState("");
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const url = weekStart
        ? `/api/slots/week?weekStart=${weekStart}`
        : "/api/slots/week";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setWeekDays(data.days);
        setBookingWindowMessage(data.bookingWindowMessage ?? "");
        if (!weekStart && data.weekStart) {
          setWeekStart(data.weekStart);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const fetchReservations = useCallback(async () => {
    const res = await fetch("/api/reservations");
    const data = await res.json();
    if (res.ok) setMyReservations(data.reservations);
  }, []);

  useEffect(() => {
    fetchWeek();
    fetchReservations();
  }, [fetchWeek, fetchReservations]);

  const slotMap = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const day of weekDays) {
      for (const slot of day.slots) {
        map.set(`${day.date}-${slot.startHour}`, slot);
      }
    }
    return map;
  }, [weekDays]);

  const weekLabel = useMemo(() => {
    if (weekDays.length === 0) return "";
    const start = parseISO(weekDays[0].date);
    const end = parseISO(weekDays[6].date);
    return `${format(start, "M월 d일", { locale: ko })} ~ ${format(end, "M월 d일", { locale: ko })}`;
  }, [weekDays]);

  const handleCellClick = async (date: string, slot: Slot) => {
    setMessage(null);

    if (slot.isMine && slot.reservationId) {
      const reservation = myReservations.find((r) => r.id === slot.reservationId);
      if (reservation?.canCancel) {
        if (!confirm(`${date} ${formatHour(slot.startHour)} 예약을 취소하시겠습니까?`)) return;
        const res = await fetch(`/api/reservations?id=${slot.reservationId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "예약이 취소되었습니다." });
          fetchWeek();
          fetchReservations();
        } else {
          setMessage({ type: "error", text: data.error?.message ?? "취소 실패" });
        }
      }
      return;
    }

    if (!slot.available || !slot.isOperating || isPastSlot(date, slot.startHour)) return;

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startHour: slot.startHour }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: "success", text: "예약이 완료되었습니다." });
      fetchWeek();
      fetchReservations();
    } else {
      setMessage({ type: "error", text: data.error?.message ?? "예약 실패" });
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("예약을 취소하시겠습니까?")) return;
    setMessage(null);
    const res = await fetch(`/api/reservations?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: "success", text: "예약이 취소되었습니다." });
      fetchWeek();
      fetchReservations();
    } else {
      setMessage({ type: "error", text: data.error?.message ?? "취소 실패" });
    }
  };

  const getCellClass = (date: string, slot: Slot | undefined) => {
    if (!slot) return "bg-gray-50";
    if (isPastSlot(date, slot.startHour)) {
      return "slot-past bg-gray-50 cursor-not-allowed";
    }
    if (slot.isMine) return "bg-primary-100 border-primary-400 cursor-pointer hover:bg-primary-200";
    if (!slot.available) {
      if (slot.isOperating && slot.bookable === false) {
        return "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60";
      }
      return "bg-red-50 border-red-100 cursor-not-allowed";
    }
    return "bg-white hover:bg-primary-50 hover:border-primary-300 cursor-pointer";
  };

  const getCellLabel = (slot: Slot | undefined) => {
    if (!slot) return "";
    if (slot.isMine) return "내 예약";
    if (!slot.available) return slot.displayLabel?.slice(0, 6) ?? "예약";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">주간 예약 현황</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                weekStart &&
                setWeekStart(format(subWeeks(parseISO(weekStart), 1), "yyyy-MM-dd"))
              }
              disabled={!weekStart}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              ← 이전 주
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-gray-700">
              {weekLabel}
            </span>
            <button
              onClick={() =>
                weekStart &&
                setWeekStart(format(addWeeks(parseISO(weekStart), 1), "yyyy-MM-dd"))
              }
              disabled={!weekStart}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              다음 주 →
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-white" /> 예약 가능
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-primary-100 border-primary-400" />{" "}
            내 예약
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-red-50" /> 예약됨
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-gray-100" /> 예약 오픈 전
          </span>
          <span className="flex items-center gap-1.5">
            <span className="slot-past inline-block h-3 w-3 rounded border border-gray-200 bg-gray-50" />{" "}
            과거 시간
          </span>
        </div>

        <div className="mb-3 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-800">
          {bookingWindowMessage && <p className="mb-1 font-medium">• {bookingWindowMessage}</p>}
          <p>• 주중(월~금): 이번 주(월~일) 언제든 예약 가능 · 주말: 토요일 14:00에 다음 주 오픈</p>
          <p>• 주간(월~일) 기본 예약: 최대 1회 (1시간) · 00:00~24:00 전 시간대 예약 가능</p>
          <p>• 21:00 이후: 내일 날짜 슬롯 추가 1회 예약 가능 (주간 제한 무시, 예약 오픈 주간 내)</p>
          <p>• 취소: 예약 3시간 전까지 · 내 예약 셀 클릭으로 취소</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-500">로딩 중...</p>
        ) : (
          <div className="max-h-[600px] overflow-auto rounded-xl border border-gray-200">
            <div className="min-w-[640px]">
              {/* Header: 요일 1행 — 세로 스크롤 시 고정 */}
              <div className="sticky top-0 z-20 grid grid-cols-[52px_repeat(7,1fr)] border-b bg-gray-50">
                <div className="sticky left-0 z-30 border-r bg-gray-50 px-1 py-2 text-center text-xs font-medium text-gray-400">
                  시간
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={day.date}
                    className="border-r bg-gray-50 px-1 py-2 text-center last:border-r-0"
                  >
                    <p className="text-sm font-bold text-gray-900">{DAY_LABELS[idx]}</p>
                    <p className="text-xs text-gray-500">
                      {format(parseISO(day.date), "M/d", { locale: ko })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Body: 0~23시 세로 배치 — 시간열은 가로 스크롤 시 고정 */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[52px_repeat(7,1fr)] border-b last:border-b-0"
                >
                  <div className="sticky left-0 z-10 flex items-center justify-center border-r bg-gray-50 px-1 py-0 text-[11px] font-medium text-gray-500">
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const slot = slotMap.get(`${day.date}-${hour}`);
                    const label = getCellLabel(slot);
                    const clickable =
                      slot?.isMine ||
                      (slot?.available && !isPastSlot(day.date, hour));

                    return (
                      <button
                        key={`${day.date}-${hour}`}
                        type="button"
                        disabled={!clickable}
                        onClick={() => slot && handleCellClick(day.date, slot)}
                        title={
                          slot?.isMine
                            ? "클릭하여 취소"
                            : slot?.available
                              ? "클릭하여 예약"
                              : slot?.bookable === false
                                ? "예약 오픈 전"
                                : slot?.displayLabel ?? "예약 불가"
                        }
                        className={`relative min-h-[28px] border-r px-0.5 py-0.5 text-[10px] transition last:border-r-0 sm:min-h-[32px] sm:text-xs ${getCellClass(day.date, slot)}`}
                      >
                        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight text-[11px] text-gray-400/70 select-none sm:text-xs">
                          <span>{DAY_LABELS[dayIdx]}</span>
                          <span>{formatHour(hour)}</span>
                        </span>
                        {label && (
                          <span
                            className={`relative z-[1] block truncate font-medium ${
                              slot?.isMine ? "text-primary-700" : "text-red-600"
                            }`}
                          >
                            {label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">내 예약 목록</h2>
        {myReservations.length === 0 ? (
          <p className="text-sm text-gray-500">예약 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {myReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {r.date} {r.timeLabel}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.isSameDayBooking ? "익일 추가 예약" : "기본 예약"}
                    {!r.canCancel && " · 취소 불가 (3시간 이내)"}
                  </p>
                </div>
                {r.canCancel && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    취소
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
