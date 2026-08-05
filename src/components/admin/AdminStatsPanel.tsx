"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { defaultStatsRangeKST } from "@/lib/kst";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface Stats {
  daily: { label: string; count: number }[];
  weekly: { label: string; count: number }[];
  monthly: { label: string; count: number }[];
  hourlyUtilization: { hour: number; count: number; rate: number }[];
  total: number;
}

interface MonthlyMemberStats {
  month: string;
  members: {
    userId: string;
    dong: string;
    name: string;
    phone: string;
    displayName: string;
    count: number;
  }[];
  totalReservations: number;
  uniqueMembers: number;
}

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function AdminStatsPanel() {
  const defaultRange = defaultStatsRangeKST();
  const [stats, setStats] = useState<Stats | null>(null);
  const [memberStats, setMemberStats] = useState<MonthlyMemberStats | null>(null);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [selectedMonth, setSelectedMonth] = useState(defaultRange.month);
  const [loading, setLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const downloadStatsExcel = async () => {
    setExporting(true);
    try {
      const url = `/api/admin/stats/export?from=${from}&to=${to}&month=${selectedMonth}`;
      const res = await fetch(url);
      if (!res.ok) {
        alert("엑셀 다운로드에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `stats-${selectedMonth}.xlsx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/stats?from=${from}&to=${to}`);
    const data = await res.json();
    if (res.ok) setStats(data);
    setLoading(false);
  }, [from, to]);

  const fetchMemberStats = useCallback(async () => {
    setMemberLoading(true);
    const res = await fetch(`/api/admin/stats/members?month=${selectedMonth}`);
    const data = await res.json();
    if (res.ok) setMemberStats(data);
    setMemberLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMemberStats();
  }, [fetchMemberStats]);

  if (loading && !stats) return <p className="text-gray-500">통계 로딩 중...</p>;
  if (!stats) return <p className="text-gray-500">통계를 불러올 수 없습니다.</p>;

  const hourlyData = stats.hourlyUtilization.map((h) => ({
    name: formatHour(h.hour),
    count: h.count,
    rate: h.rate,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{stats.total}건</p>
          <p className="text-sm text-gray-500">선택 기간 총 예약</p>
        </div>
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
        <button
          type="button"
          onClick={downloadStatsExcel}
          disabled={exporting}
          className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {exporting ? "다운로드 중..." : "엑셀 다운로드"}
        </button>
      </div>

      {/* 월별 예약 회원 집계 */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">월별 예약 회원 집계</h3>
            <p className="mt-1 text-xs text-gray-500">
              선택 월에 예약한 회원별 이용 횟수 (동 + 이름 마스킹)
            </p>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>

        {memberLoading ? (
          <p className="text-gray-500">회원 집계 로딩 중...</p>
        ) : memberStats ? (
          <>
            <div className="mb-4 flex gap-6 text-sm">
              <div>
                <span className="font-bold text-primary-700">{memberStats.uniqueMembers}</span>
                <span className="text-gray-500">명 예약</span>
              </div>
              <div>
                <span className="font-bold text-primary-700">{memberStats.totalReservations}</span>
                <span className="text-gray-500">건 총 예약</span>
              </div>
            </div>

            {memberStats.members.length === 0 ? (
              <p className="text-sm text-gray-500">해당 월 예약 회원이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 font-medium">순위</th>
                      <th className="px-4 py-2 font-medium">회원 (동/이름)</th>
                      <th className="px-4 py-2 font-medium">휴대폰</th>
                      <th className="px-4 py-2 font-medium">예약 횟수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {memberStats.members.map((m, idx) => (
                      <tr key={m.userId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{m.displayName}</td>
                        <td className="px-4 py-2 text-gray-600">{m.phone || "-"}</td>
                        <td className="px-4 py-2">{m.count}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">회원 집계를 불러올 수 없습니다.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">일별 예약 건수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">주별 예약 건수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">월별 예약 건수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#15803d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">타임별 이용률 (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
