"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";

interface AdminReservation {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  timeLabel: string;
  isSameDayBooking: boolean;
  canCancel: boolean;
  user: { id: string; name: string; email: string; dong: string; displayName: string };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function AdminReservationsPanel() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);

  const [newRes, setNewRes] = useState({
    userId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startHour: 9,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [resRes, userRes] = await Promise.all([
      fetch(`/api/admin/reservations?from=${from}&to=${to}`),
      fetch("/api/admin/users"),
    ]);
    const resData = await resRes.json();
    const userData = await userRes.json();
    if (resRes.ok) setReservations(resData.reservations);
    if (userRes.ok) setUsers(userData.users.filter((u: AdminUser) => u.role === "USER" && u.isActive));
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleForceCancel = async (id: string) => {
    if (!confirm("관리자 권한으로 예약을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/admin/reservations?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
    else {
      const data = await res.json();
      alert(data.error?.message ?? "취소 실패");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRes),
    });
    if (res.ok) {
      fetchData();
      alert("예약이 등록되었습니다.");
    } else {
      const data = await res.json();
      alert(data.error?.message ?? "등록 실패");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">관리자 강제 예약 등록</h3>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">회원</label>
            <select
              value={newRes.userId}
              onChange={(e) => setNewRes({ ...newRes, userId: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
              required
            >
              <option value="">선택</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitLabel} {u.displayName.split(" ").slice(1).join(" ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">날짜</label>
            <input
              type="date"
              value={newRes.date}
              onChange={(e) => setNewRes({ ...newRes, date: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">시작 시간</label>
            <select
              value={newRes.startHour}
              onChange={(e) =>
                setNewRes({ ...newRes, startHour: Number(e.target.value) })
              }
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            등록
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <h3 className="flex-1 font-semibold text-gray-900">예약 현황</h3>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-gray-500">로딩 중...</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-gray-500">예약 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2">날짜</th>
                  <th className="px-3 py-2">시간</th>
                  <th className="px-3 py-2">회원</th>
                  <th className="px-3 py-2">유형</th>
                  <th className="px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.timeLabel}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.user.displayName}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.isSameDayBooking ? "익일 추가" : "기본"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleForceCancel(r.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        강제 취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
