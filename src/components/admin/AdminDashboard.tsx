"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminReservationsPanel } from "@/components/admin/AdminReservationsPanel";
import { AdminStatsPanel } from "@/components/admin/AdminStatsPanel";
import { useState } from "react";

type Tab = "users" | "reservations" | "stats";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "회원 관리" },
    { id: "reservations", label: "예약 관리" },
    { id: "stats", label: "통계/집계" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
            <p className="text-sm text-gray-500">{user?.name} (관리자)</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              예약 페이지
            </Link>
            <button
              onClick={() => logout()}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "users" && <AdminUsersPanel />}
        {tab === "reservations" && <AdminReservationsPanel />}
        {tab === "stats" && <AdminStatsPanel />}
      </div>
    </div>
  );
}
