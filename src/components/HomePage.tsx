"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoginForm } from "@/components/LoginForm";
import { ReservationCalendar } from "@/components/ReservationCalendar";

export function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "ADMIN") {
      router.replace("/admin");
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-green-100 p-4">
        <LoginForm />
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">관리자 페이지로 이동 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">스크린골프 예약</h1>
            <p className="text-sm text-gray-500">{user.name}님, 환영합니다</p>
          </div>
          <button
            onClick={() => logout()}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <ReservationCalendar />
      </main>
    </div>
  );
}
