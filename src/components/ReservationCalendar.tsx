"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, addWeeks, subWeeks, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { formatDateKST, isPastSlotKST, nowKST } from "@/lib/kst";
import {
  CANCEL_DEADLINE_HOUR_DAY_BEFORE,
  MAX_GROUP_SIZE,
  NEXT_DAY_BONUS_START_HOUR,
  canCancelReservation,
  cancelBlockedReason,
  getAllDayHours,
  parseDateInput,
} from "@/lib/utils";
import { StatusMessageModal } from "@/components/StatusMessageModal";

interface Slot {
  startHour: number;
  endHour: number;
  available: boolean;
  isOperating: boolean;
  bookable?: boolean;
  isCleaning?: boolean;
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
  createdAt?: string | null;
  groupId?: string | null;
  isGroup?: boolean;
}

interface Friend {
  id: string;
  friendUserId: string;
  name: string;
  unitLabel: string;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const HOURS = getAllDayHours();

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [hoverRange, setHoverRange] = useState<{ date: string; startHour: number } | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{
    date: string;
    startHour: number;
  } | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);
  const [booking, setBooking] = useState(false);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const calendarScrollRef = useRef<HTMLDivElement>(null);

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

  const fetchFriends = useCallback(async () => {
    const res = await fetch("/api/friends");
    const data = await res.json();
    if (res.ok) setFriends(data.friends ?? []);
  }, []);

  useEffect(() => {
    fetchWeek();
    fetchReservations();
    fetchFriends();
  }, [fetchWeek, fetchReservations, fetchFriends]);

  useEffect(() => {
    const onFriendsUpdated = () => {
      fetchFriends();
    };
    window.addEventListener("friends-updated", onFriendsUpdated);
    return () => window.removeEventListener("friends-updated", onFriendsUpdated);
  }, [fetchFriends]);

  useEffect(() => {
    setPendingBooking(null);
    setConfirmPos(null);
  }, [weekStart]);

  useEffect(() => {
    const valid = new Set(friends.map((friend) => friend.friendUserId));
    setSelectedFriendIds((prev) => prev.filter((id) => valid.has(id)));
  }, [friends]);

  const groupSize = 1 + selectedFriendIds.length;
  const groupMode = groupSize > 1;

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

  const isRangeBookable = (date: string, startHour: number, size: number) => {
    for (let i = 0; i < size; i++) {
      const hour = startHour + i;
      const slot = slotMap.get(`${date}-${hour}`);
      if (
        !slot ||
        slot.isCleaning ||
        !slot.available ||
        !slot.isOperating ||
        isPastSlot(date, hour)
      ) {
        return false;
      }
    }
    return true;
  };

  const isInHoverRange = (date: string, hour: number) => {
    if (!hoverRange || hoverRange.date !== date) return false;
    return hour >= hoverRange.startHour && hour < hoverRange.startHour + groupSize;
  };

  const isInPendingRange = (date: string, hour: number) => {
    if (!pendingBooking || pendingBooking.date !== date) return false;
    return (
      hour >= pendingBooking.startHour &&
      hour < pendingBooking.startHour + groupSize
    );
  };

  const updateConfirmPosition = useCallback(() => {
    if (!pendingBooking) {
      setConfirmPos(null);
      return;
    }
    const el = cellRefs.current.get(`${pendingBooking.date}-${pendingBooking.startHour}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setConfirmPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, [pendingBooking]);

  useEffect(() => {
    if (!pendingBooking) {
      setConfirmPos(null);
      return;
    }
    updateConfirmPosition();
    const scrollEl = calendarScrollRef.current;
    window.addEventListener("resize", updateConfirmPosition);
    scrollEl?.addEventListener("scroll", updateConfirmPosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updateConfirmPosition);
      scrollEl?.removeEventListener("scroll", updateConfirmPosition);
    };
  }, [pendingBooking, updateConfirmPosition, weekDays]);

  const closeBookingConfirm = () => {
    if (booking) return;
    setPendingBooking(null);
    setConfirmPos(null);
  };

  const toggleFriend = (friendUserId: string) => {
    setSelectedFriendIds((prev) => {
      if (prev.includes(friendUserId)) {
        return prev.filter((id) => id !== friendUserId);
      }
      if (prev.length + 1 >= MAX_GROUP_SIZE) {
        setMessage({
          type: "error",
          text: `단체 예약은 본인 포함 최대 ${MAX_GROUP_SIZE}명까지 가능합니다.`,
        });
        return prev;
      }
      return [...prev, friendUserId];
    });
  };

  const handleCellClick = async (date: string, slot: Slot) => {
    setMessage(null);

    if (slot.isMine && slot.reservationId) {
      const reservation = myReservations.find((r) => r.id === slot.reservationId);
      const allowCancel =
        reservation?.canCancel ||
        (reservation
          ? canCancelReservation(
              parseDateInput(reservation.date),
              reservation.startHour,
              reservation.createdAt
            )
          : false);
      if (!allowCancel) {
        setMessage({
          type: "error",
          text: reservation
            ? cancelBlockedReason(
                parseDateInput(reservation.date),
                reservation.startHour,
                reservation.createdAt
              )
            : "지금은 취소할 수 없습니다.",
        });
        return;
      }
      const cancelText = reservation?.isGroup
        ? `${date} ${formatHour(slot.startHour)} 단체 예약 전체를 취소하시겠습니까?`
        : `${date} ${formatHour(slot.startHour)} 예약을 취소하시겠습니까?`;
      if (!confirm(cancelText)) return;
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
      return;
    }

    if (slot.isCleaning) return;
    if (!groupMode && (!slot.available || !slot.isOperating || isPastSlot(date, slot.startHour))) return;

    if (!isRangeBookable(date, slot.startHour, groupSize)) {
      setMessage({
        type: "error",
        text: `연속 ${groupSize}시간 예약이 가능한 빈 칸이 아닙니다.`,
      });
      return;
    }

    setHoverRange(null);
    setPendingBooking({ date, startHour: slot.startHour });
  };

  const confirmBooking = async () => {
    if (!pendingBooking || booking) return;
    setBooking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: pendingBooking.date,
          startHour: pendingBooking.startHour,
          friendIds: selectedFriendIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingBooking(null);
        setConfirmPos(null);
        setMessage({
          type: "success",
          text: groupMode ? "단체 예약이 완료되었습니다." : "예약이 완료되었습니다.",
        });
        fetchWeek();
        fetchReservations();
      } else {
        setMessage({ type: "error", text: data.error?.message ?? "예약 실패" });
      }
    } finally {
      setBooking(false);
    }
  };

  const handleCancel = async (id: string) => {
    const reservation = myReservations.find((item) => item.id === id);
    if (
      !confirm(
        reservation?.isGroup
          ? "단체 예약 전체를 취소하시겠습니까?"
          : "예약을 취소하시겠습니까?"
      )
    )
      return;
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
    if (slot.isCleaning) {
      return "bg-amber-50 border-amber-200 cursor-not-allowed";
    }
    const pending = isInPendingRange(date, slot.startHour);
    if (pending && !slot.isMine && !slot.reservationId) {
      return "bg-primary-300 border-primary-500 ring-2 ring-primary-400 ring-inset cursor-pointer";
    }
    const hovering = isInHoverRange(date, slot.startHour);
    if (hovering && !slot.isMine && !slot.reservationId && !pendingBooking) {
      return isRangeBookable(date, hoverRange!.startHour, groupSize)
        ? "bg-primary-200 border-primary-400 cursor-pointer"
        : "bg-red-100 border-red-200 cursor-not-allowed";
    }
    const past = isPastSlot(date, slot.startHour);
    if (slot.isMine) {
      return past
        ? "slot-past bg-primary-100 border-primary-400 cursor-not-allowed"
        : "bg-primary-100 border-primary-400 cursor-pointer hover:bg-primary-200";
    }
    if (!slot.available) {
      if (slot.reservationId || slot.displayLabel) {
        return past
          ? "slot-past bg-red-50 border-red-100 cursor-not-allowed"
          : "bg-red-50 border-red-100 cursor-not-allowed";
      }
      if (slot.isOperating && slot.bookable === false) {
        return past
          ? "slot-past bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
          : "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60";
      }
      return past
        ? "slot-past bg-gray-50 cursor-not-allowed"
        : "bg-gray-50 cursor-not-allowed";
    }
    if (past) return "slot-past bg-gray-50 cursor-not-allowed";
    return "bg-white hover:bg-primary-50 hover:border-primary-300 cursor-pointer";
  };

  const getCellLabel = (_date: string, slot: Slot | undefined) => {
    if (!slot) return "";
    if (slot.isCleaning) return "청소시간";
    if (slot.isMine) return "내 예약";
    if (slot.reservationId || (!slot.available && slot.displayLabel)) {
      return slot.displayLabel?.slice(0, 6) ?? "예약";
    }
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

        <StatusMessageModal message={message} onClose={() => setMessage(null)} />

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-white" /> 예약 가능
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-primary-200 border-primary-400" />{" "}
            단체 선택
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-primary-100 border-primary-400" />{" "}
            내 예약
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-red-50" /> 예약됨
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-amber-50 border-amber-200" />{" "}
            청소시간
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
          <p>• 주간(월~일) 기본 예약: 최대 1회 (1시간) · 06:00~24:00 예약 가능 (주중 09:00~10:00 청소시간 제외, 토·일은 청소시간 없음)</p>
          <p>• 당일 빈 슬롯: 주간 예약과 별도로 추가 1회 예약 가능</p>
          <p>• {formatHour(NEXT_DAY_BONUS_START_HOUR)} 이후: 내일 날짜 슬롯 추가 1회 예약 가능 (주간 제한 무시, 예약 오픈 주간 내)</p>
          <p>• 단체 예약: 친구를 선택한 인원수만큼 연속 시간을 한 번에 예약 (본인 포함 최대 {MAX_GROUP_SIZE}명)</p>
          <p>• 취소: 예약 후 10분 이내(예약 시간·당일 여부 무관), 또는 예약 전날 {formatHour(CANCEL_DEADLINE_HOUR_DAY_BEFORE)} 이전 · 내 예약 셀 클릭으로 취소</p>
        </div>

        <div className="mb-3 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">단체 예약</p>
            <p className="text-xs text-gray-600">
              선택 인원 {groupSize}명 · 연속 {groupSize}시간
              {groupMode ? " · 시간에 마우스를 올리면 같은 수만큼 칸이 함께 표시됩니다" : ""}
            </p>
          </div>
          {friends.length === 0 ? (
            <p className="text-xs text-gray-500">
              위에서 친구를 추가하면 함께 예약할 수 있습니다.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {friends.map((friend) => {
                const checked = selectedFriendIds.includes(friend.friendUserId);
                return (
                  <li key={friend.friendUserId}>
                    <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      checked
                        ? "border-primary-400 bg-white text-primary-800"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFriend(friend.friendUserId)}
                        className="accent-primary-600"
                      />
                      <span>{friend.name}</span>
                      <span className="text-gray-400">{friend.unitLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-500">로딩 중...</p>
        ) : (
          <div
            ref={calendarScrollRef}
            className="max-h-[600px] overflow-auto rounded-xl border border-gray-200"
            onMouseLeave={() => setHoverRange(null)}
          >
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

              {/* Body: 06~23시 세로 배치 — 시간열은 가로 스크롤 시 고정 */}
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
                    const label = getCellLabel(day.date, slot);
                    const clickable =
                      !slot?.isCleaning &&
                      (slot?.isMine ||
                        (groupMode
                          ? Boolean(slot)
                          : Boolean(slot?.available && !isPastSlot(day.date, hour))));

                    return (
                      <button
                        key={`${day.date}-${hour}`}
                        type="button"
                        ref={(el) => {
                          const key = `${day.date}-${hour}`;
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                        disabled={!clickable || booking}
                        onMouseEnter={() => {
                          if (pendingBooking) return;
                          if (!slot || slot.isCleaning || slot.isMine || slot.reservationId) {
                            setHoverRange(null);
                            return;
                          }
                          setHoverRange({ date: day.date, startHour: hour });
                        }}
                        onClick={() => slot && handleCellClick(day.date, slot)}
                        title={
                          slot?.isCleaning
                            ? "청소시간"
                            : slot?.isMine
                              ? "클릭하여 취소"
                              : groupMode
                                ? `${groupSize}시간 단체 예약`
                                : slot?.available
                                  ? "클릭하여 예약"
                                  : slot?.bookable === false
                                    ? "예약 오픈 전"
                                    : slot?.displayLabel ?? "예약 불가"
                        }
                        className={`relative min-h-[28px] border-r px-0.5 py-0.5 text-[10px] transition last:border-r-0 sm:min-h-[32px] sm:text-xs ${getCellClass(day.date, slot)}`}
                      >
                        {!(slot?.isCleaning || slot?.isMine || slot?.reservationId) && (
                          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight text-[11px] text-gray-400/70 select-none sm:text-xs">
                            <span>{DAY_LABELS[dayIdx]}</span>
                            <span>{formatHour(hour)}</span>
                          </span>
                        )}
                        {label && (
                          <span
                            className={`relative z-[1] block truncate font-medium ${
                              slot?.isCleaning
                                ? "text-amber-800"
                                : slot?.isMine
                                  ? "text-primary-700"
                                  : "text-red-600"
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

      {pendingBooking && confirmPos && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            onClick={closeBookingConfirm}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirm-title"
            className="fixed z-[60] w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-full rounded-xl border border-primary-200 bg-white p-3 shadow-xl"
            style={{ top: confirmPos.top - 10, left: confirmPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white drop-shadow" />
            <h3 id="booking-confirm-title" className="text-sm font-semibold text-gray-900">
              예약할까요?
            </h3>
            <p className="mt-1 text-sm text-gray-700">
              {pendingBooking.date}{" "}
              {formatHour(pendingBooking.startHour)}
              {groupSize > 1
                ? `-${formatHour(pendingBooking.startHour + groupSize)}`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {groupMode
                ? `단체 ${groupSize}명 · 연속 ${groupSize}시간 (나 + ${friends
                    .filter((friend) => selectedFriendIds.includes(friend.friendUserId))
                    .map((friend) => friend.name)
                    .join(", ")})`
                : "개인 예약 1시간"}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBookingConfirm}
                disabled={booking}
                className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmBooking}
                disabled={booking}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {booking ? "예약 중..." : "예약"}
              </button>
            </div>
          </div>
        </>
      )}

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
                    {r.isGroup
                      ? "단체 예약"
                      : r.isSameDayBooking
                        ? r.date === formatDateKST(nowKST())
                          ? "당일 추가 예약"
                          : "익일 추가 예약"
                        : "기본 예약"}
                    {!(
                      r.canCancel ||
                      canCancelReservation(
                        parseDateInput(r.date),
                        r.startHour,
                        r.createdAt
                      )
                    ) && " · 취소 불가"}
                  </p>
                </div>
                {(r.canCancel ||
                  canCancelReservation(
                    parseDateInput(r.date),
                    r.startHour,
                    r.createdAt
                  )) && (
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
