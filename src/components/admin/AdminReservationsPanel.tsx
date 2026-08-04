"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  addWeeks,
  subWeeks,
  parseISO,
  startOfDay,
  addHours,
  isBefore,
} from "date-fns";
import { ko } from "date-fns/locale";

interface Slot {
  startHour: number;
  endHour: number;
  available: boolean;
  isOperating: boolean;
  bookable?: boolean;
  reservationId?: string;
  displayLabel?: string;
}

interface DaySlots {
  date: string;
  slots: Slot[];
}

interface AdminUser {
  id: string;
  name: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function isPastSlot(dateStr: string, hour: number): boolean {
  const slotTime = addHours(startOfDay(parseISO(dateStr)), hour);
  return isBefore(slotTime, new Date());
}

export function AdminReservationsPanel() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users.filter((u: AdminUser) => u.role === "USER" && u.isActive));
    }
  }, []);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const url = weekStart
        ? `/api/admin/slots/week?weekStart=${weekStart}`
        : "/api/admin/slots/week";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setWeekDays(data.days);
        if (!weekStart && data.weekStart) {
          setWeekStart(data.weekStart);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

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

  const weekReservations = useMemo(() => {
    const items: { id: string; date: string; startHour: number; displayLabel: string }[] = [];
    for (const day of weekDays) {
      for (const slot of day.slots) {
        if (slot.reservationId && slot.displayLabel) {
          items.push({
            id: slot.reservationId,
            date: day.date,
            startHour: slot.startHour,
            displayLabel: slot.displayLabel,
          });
        }
      }
    }
    return items.sort(
      (a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour
    );
  }, [weekDays]);

  const handleCellClick = async (date: string, slot: Slot) => {
    setMessage(null);

    if (slot.reservationId) {
      if (!confirm(`${date} ${formatHour(slot.startHour)} (${slot.displayLabel}) 예약을 취소하시겠습니까?`)) {
        return;
      }
      const res = await fetch(`/api/admin/reservations?id=${slot.reservationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "예약이 취소되었습니다." });
        fetchWeek();
      } else {
        setMessage({ type: "error", text: data.error?.message ?? "취소 실패" });
      }
      return;
    }

    if (!slot.available || !slot.isOperating || isPastSlot(date, slot.startHour)) return;

    if (!selectedUserId) {
      setMessage({ type: "error", text: "예약할 회원을 먼저 선택해 주세요." });
      return;
    }

    const res = await fetch("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, date, startHour: slot.startHour }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: "success", text: "예약이 등록되었습니다." });
      fetchWeek();
    } else {
      setMessage({ type: "error", text: data.error?.message ?? "예약 실패" });
    }
  };

  const getCellClass = (date: string, slot: Slot | undefined) => {
    if (!slot) return "bg-gray-50";
    if (isPastSlot(date, slot.startHour)) return "bg-gray-50 cursor-not-allowed opacity-50";
    if (!slot.available && slot.reservationId) {
      return "bg-red-50 border-red-100 cursor-pointer hover:bg-red-100";
    }
    if (!slot.available) return "bg-gray-50 cursor-not-allowed";
    return "bg-white hover:bg-primary-50 hover:border-primary-300 cursor-pointer";
  };

  const getCellLabel = (slot: Slot | undefined) => {
    if (!slot) return "";
    if (!slot.available && slot.displayLabel) {
      return slot.displayLabel.slice(0, 8);
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">주간 예약 관리</h2>
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

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">예약 회원</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="min-w-[200px] rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">회원 선택</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitLabel} {u.displayName.split(" ").slice(1).join(" ")}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            빈 칸 클릭 → 예약 등록 · 예약된 칸 클릭 → 취소
          </p>
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
            <span className="inline-block h-3 w-3 rounded border bg-red-50" /> 예약됨 (클릭 취소)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-gray-50" /> 과거 시간
          </span>
        </div>

        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p>• 관리자는 예약 오픈 시간·주간 제한 없이 예약/취소 가능</p>
          <p>• 예약 등록 전 상단에서 회원을 선택하세요</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-500">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <div className="min-w-[640px]">
              <div className="sticky top-0 z-10 grid grid-cols-[52px_repeat(7,1fr)] border-b bg-gray-50">
                <div className="border-r px-1 py-2 text-center text-xs font-medium text-gray-400">
                  시간
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={day.date}
                    className="border-r px-1 py-2 text-center last:border-r-0"
                  >
                    <p className="text-sm font-bold text-gray-900">{DAY_LABELS[idx]}</p>
                    <p className="text-xs text-gray-500">
                      {format(parseISO(day.date), "M/d", { locale: ko })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[52px_repeat(7,1fr)] border-b last:border-b-0"
                  >
                    <div className="sticky left-0 z-[1] flex items-center justify-center border-r bg-gray-50 px-1 py-0 text-[11px] font-medium text-gray-500">
                      {formatHour(hour)}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const slot = slotMap.get(`${day.date}-${hour}`);
                      const label = getCellLabel(slot);
                      const clickable =
                        (slot?.reservationId && !isPastSlot(day.date, hour)) ||
                        (slot?.available && !isPastSlot(day.date, hour));

                      return (
                        <button
                          key={`${day.date}-${hour}`}
                          type="button"
                          disabled={!clickable}
                          onClick={() => slot && handleCellClick(day.date, slot)}
                          title={
                            slot?.reservationId
                              ? `${slot.displayLabel} · 클릭하여 취소`
                              : slot?.available
                                ? "클릭하여 예약"
                                : "예약 불가"
                          }
                          className={`relative min-h-[28px] border-r px-0.5 py-0.5 text-[10px] transition last:border-r-0 sm:min-h-[32px] sm:text-xs ${getCellClass(day.date, slot)}`}
                        >
                          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight text-[9px] text-gray-400/35 select-none sm:text-[10px]">
                            <span>{DAY_LABELS[dayIdx]}</span>
                            <span>{formatHour(hour)}</span>
                          </span>
                          {label && (
                            <span className="relative z-[1] block truncate font-medium text-red-600">
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
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">이번 주 예약 목록</h2>
        {weekReservations.length === 0 ? (
          <p className="text-sm text-gray-500">예약 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {weekReservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {r.date} {formatHour(r.startHour)}
                  </p>
                  <p className="text-xs text-gray-500">{r.displayLabel}</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("예약을 취소하시겠습니까?")) return;
                    setMessage(null);
                    const res = await fetch(`/api/admin/reservations?id=${r.id}`, {
                      method: "DELETE",
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setMessage({ type: "success", text: "예약이 취소되었습니다." });
                      fetchWeek();
                    } else {
                      setMessage({ type: "error", text: data.error?.message ?? "취소 실패" });
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
