"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "pwa-notify-dismissed-member";
const INSTALL_DISMISS_KEY = "pwa-install-dismissed-member";

function canAskNotification(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** 향후 Web Push 구독 시 사용할 권한 상태 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!canAskNotification()) return "unsupported";
  return Notification.permission;
}

export function NotificationPermissionPrompt() {
  const pathname = usePathname();
  const isMember = !pathname.startsWith("/admin");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMember || !canAskNotification()) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const tryShow = () => {
      if (Notification.permission !== "default") return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setVisible(true);
    };

    // 설치 유도 배너가 있으면 닫힌 뒤에 표시
    const installDismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    const delayMs = installDismissed ? 1500 : 6000;
    const timer = window.setTimeout(tryShow, delayMs);

    const onInstallClosed = () => {
      window.setTimeout(tryShow, 800);
    };
    window.addEventListener("pwa-install-dismissed", onInstallClosed);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pwa-install-dismissed", onInstallClosed);
    };
  }, [isMember, pathname]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const allow = async () => {
    try {
      const result = await Notification.requestPermission();
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
      if (result === "granted") {
        // 향후 push subscription 등록 지점
        window.dispatchEvent(new CustomEvent("pwa-notification-granted"));
      }
    } catch {
      dismiss();
    }
  };

  if (!visible || !isMember) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-primary-200 bg-white p-4 shadow-lg"
        role="dialog"
        aria-label="알림 허용 안내"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">예약 알림 받기</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              예약 확정·리마인드 등 푸시 알림을 받으려면 알림을 허용해 주세요.
              (나중에 설정에서 변경할 수 있습니다)
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-gray-700"
            aria-label="닫기"
          >
            나중에
          </button>
        </div>
        <button
          type="button"
          onClick={allow}
          className="mt-3 w-full rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          알림 허용
        </button>
      </div>
    </div>
  );
}
