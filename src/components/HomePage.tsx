"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { LoginForm } from "@/components/LoginForm";
import { FriendsPanel } from "@/components/FriendsPanel";
import { PrivacyConsentForm } from "@/components/PrivacyConsentForm";
import { PrivacyStatusPanel } from "@/components/PrivacyStatusPanel";
import { ReservationCalendar } from "@/components/ReservationCalendar";
import { SuggestionBoard } from "@/components/SuggestionBoard";

type MemberTab = "booking" | "privacy";

export function HomePage() {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [tab, setTab] = useState<MemberTab>("booking");

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
        <LoginForm mode="member" />
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

  if (!user.privacyConsented) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-green-100 p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
          <PrivacyConsentForm
            mode="gate"
            initialFriendSearchConsent={Boolean(user.friendSearchConsent)}
            onSaved={async () => {
              await refresh();
            }}
          />
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            로그아웃
          </button>
        </div>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              비밀번호 변경
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4">
        <nav className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("booking")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "booking"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            }`}
          >
            예약
          </button>
          <button
            type="button"
            onClick={() => setTab("privacy")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "privacy"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            }`}
          >
            개인정보이용현황
          </button>
        </nav>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {tab === "booking" ? (
          <>
            <FriendsPanel friendSearchEnabled={Boolean(user.friendSearchConsent)} />
            <ReservationCalendar />
            <SuggestionBoard />
          </>
        ) : (
          <PrivacyStatusPanel
            friendSearchConsent={Boolean(user.friendSearchConsent)}
            privacyConsentAt={user.privacyConsentAt}
            onUpdated={refresh}
          />
        )}
      </main>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
