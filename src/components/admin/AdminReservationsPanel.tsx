"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { ko } from "date-fns/locale";
import { StatusMessageModal } from "@/components/StatusMessageModal";

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
  phone?: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

interface PendingSlot {
  date: string;
  startHour: number;
}

function normalizeUnitPart(value: string, suffix: string) {
  let v = value.trim();
  if (v.endsWith(suffix)) v = v.slice(0, -suffix.length).trim();
  return v;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function AdminReservationsPanel() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [matches, setMatches] = useState<AdminUser[] | null>(null);
  const [booking, setBooking] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

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

    if (!slot.available || !slot.isOperating) return;

    setPendingSlot({ date, startHour: slot.startHour });
    setDong("");
    setHo("");
    setMatches(null);
  };

  const closeBookingModal = () => {
    if (booking) return;
    setPendingSlot(null);
    setDong("");
    setHo("");
    setMatches(null);
  };

  const openResetModal = () => {
    setResetPassword("");
    setResetOpen(true);
  };

  const closeResetModal = () => {
    if (resetting) return;
    setResetOpen(false);
    setResetPassword("");
  };

  const handleResetReservations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword.trim()) {
      setMessage({ type: "error", text: "관리자 비밀번호를 입력해 주세요." });
      return;
    }

    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reservations/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetOpen(false);
        setResetPassword("");
        setMessage({
          type: "success",
          text: `예약이 초기화되었습니다. (${data.deleted ?? 0}건 삭제)`,
        });
        fetchWeek();
      } else {
        setMessage({ type: "error", text: data.error?.message ?? "초기화 실패" });
      }
    } finally {
      setResetting(false);
    }
  };

  const bookForUser = async (user: AdminUser, slot: PendingSlot) => {
    setBooking(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          date: slot.date,
          startHour: slot.startHour,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingSlot(null);
        setDong("");
        setHo("");
        setMatches(null);
        setMessage({ type: "success", text: `${user.unitLabel} ${user.name} 예약이 등록되었습니다.` });
        fetchWeek();
      } else {
        setMessage({ type: "error", text: data.error?.message ?? "예약 실패" });
      }
    } finally {
      setBooking(false);
    }
  };

  const handleFindMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSlot) return;

    const dongKey = normalizeUnitPart(dong, "동");
    const hoKey = normalizeUnitPart(ho, "호");
    if (!dongKey || !hoKey) {
      setMessage({ type: "error", text: "동과 호수를 입력해 주세요." });
      return;
    }

    const found = users.filter(
      (u) =>
        normalizeUnitPart(u.dong, "동") === dongKey &&
        normalizeUnitPart(u.ho, "호") === hoKey
    );

    if (found.length === 0) {
      setMatches([]);
      return;
    }
    if (found.length === 1) {
      await bookForUser(found[0], pendingSlot);
      return;
    }
    setMatches(found);
  };

  const getCellClass = (date: string, slot: Slot | undefined) => {
    if (!slot) return "bg-gray-50";
    // 관리자: 과거 슬롯도 예약/취소 가능 · 빗금 없음
    if (!slot.available && slot.reservationId) {
      return "bg-red-50 border-red-100 cursor-pointer hover:bg-red-100";
    }
    if (!slot.available) return "bg-gray-50 cursor-not-allowed";
    return "bg-white hover:bg-primary-50 hover:border-primary-300 cursor-pointer";
  };

  const getCellLabel = (_date: string, slot: Slot | undefined) => {
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openResetModal}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              예약 초기화
            </button>
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

        <p className="mb-4 text-xs text-gray-500">
          빈 칸 클릭 → 동·호수 입력 후 예약 · 예약된 칸 클릭 → 취소
        </p>

        <StatusMessageModal message={message} onClose={() => setMessage(null)} />

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-white" /> 예약 가능
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border bg-red-50" /> 예약됨 (클릭 취소)
          </span>
        </div>

        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p>• 관리자는 예약 오픈 시간·주간 제한 없이 예약/취소 가능</p>
          <p>• 빈 슬롯을 클릭한 뒤 동·호수를 입력하세요. 동일 세대가 여러 명이면 목록에서 선택합니다.</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-500">로딩 중...</p>
        ) : (
          <div className="max-h-[600px] overflow-auto rounded-xl border border-gray-200">
            <div className="min-w-[640px]">
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
                    const clickable = Boolean(
                      slot?.reservationId || slot?.available
                    );

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
                        {!slot?.reservationId && (
                          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight text-[11px] text-gray-400/70 select-none sm:text-xs">
                            <span>{DAY_LABELS[dayIdx]}</span>
                            <span>{formatHour(hour)}</span>
                          </span>
                        )}
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

      {pendingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeBookingModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-book-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-book-title" className="text-lg font-semibold text-gray-900">
              예약 회원 입력
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {pendingSlot.date} {formatHour(pendingSlot.startHour)}
            </p>

            {matches && matches.length > 1 ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-700">
                  동일 동·호수 회원이 {matches.length}명입니다. 예약할 회원을 선택하세요.
                </p>
                <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border">
                  {matches.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={booking}
                        onClick={() => bookForUser(u, pendingSlot)}
                        className="flex w-full items-center justify-between px-3 py-3 text-left text-sm hover:bg-primary-50 disabled:opacity-60"
                      >
                        <span className="font-medium text-gray-900">{u.name}</span>
                        <span className="text-xs text-gray-500">
                          {u.unitLabel}
                          {u.phone ? ` · ${u.phone}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={booking}
                  onClick={() => setMatches(null)}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  동·호수 다시 입력
                </button>
              </div>
            ) : (
              <form onSubmit={handleFindMember} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm text-gray-700">동</span>
                    <input
                      value={dong}
                      onChange={(e) => setDong(e.target.value)}
                      autoFocus
                      required
                      placeholder="101"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-gray-700">호수</span>
                    <input
                      value={ho}
                      onChange={(e) => setHo(e.target.value)}
                      required
                      placeholder="1001"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                  </label>
                </div>
                {matches && matches.length === 0 && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    해당 동·호수의 회원을 찾을 수 없습니다.
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeBookingModal}
                    disabled={booking}
                    className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={booking}
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
                  >
                    {booking ? "예약 중..." : "확인"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {resetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeResetModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-reservations-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reset-reservations-title" className="text-lg font-semibold text-gray-900">
              예약 초기화
            </h2>
            <p className="mt-2 text-sm text-red-600">
              모든 예약이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <form onSubmit={handleResetReservations} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-gray-700">관리자 비밀번호</span>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoFocus
                  required
                  placeholder="비밀번호 입력"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeResetModal}
                  disabled={resetting}
                  className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {resetting ? "초기화 중..." : "초기화"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
