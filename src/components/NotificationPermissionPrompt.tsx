"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "pwa-notify-dismissed-member";
const INSTALL_DISMISS_KEY = "pwa-install-dismissed-member";

function canAskNotification(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("kakaotalk") ||
    ua.includes("instagram") ||
    ua.includes("fban") ||
    ua.includes("fbav") ||
    ua.includes("line/") ||
    (ua.includes("naver") && (ua.includes("inapp") || ua.includes("naver("))) ||
    ua.includes("; wv)") ||
    ua.includes("webview")
  );
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const mobile = /android|iphone|ipad|ipod|mobile|windows phone/i.test(ua);
  return !mobile && window.matchMedia("(pointer: fine)").matches;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches
  );
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
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    if (!isMember || !canAskNotification()) return;
    if (isInAppBrowser()) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const desktopEnv = isDesktop();
    setDesktop(desktopEnv);

    const tryShow = () => {
      if (Notification.permission !== "default") return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      // 설치 배너와 겹치지 않게: 설치 안내가 열려 있으면 잠시 대기
      if (localStorage.getItem(INSTALL_DISMISS_KEY) !== "1" && !desktopEnv) {
        // 모바일은 설치 닫힌 뒤 우선
      }
      setVisible(true);
    };

    const installDismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    // PC는 더 빨리, 모바일은 설치 안내 이후
    const delayMs = desktopEnv ? (installDismissed ? 1200 : 3500) : installDismissed ? 1500 : 6500;
    const timer = window.setTimeout(tryShow, delayMs);

    const onInstallClosed = () => {
      window.setTimeout(tryShow, desktopEnv ? 600 : 800);
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
        if (!isStandalone()) {
          // PC 브라우저에서도 권한만 확보 — 구독은 향후 추가
        }
        window.dispatchEvent(new CustomEvent("pwa-notification-granted"));
      }
    } catch {
      dismiss();
    }
  };

  if (!visible || !isMember) return null;

  const shellClass = desktop
    ? "pointer-events-none fixed bottom-6 right-6 z-40 flex justify-end p-0"
    : "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]";

  return (
    <div className={shellClass}>
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-primary-200 bg-white p-4 shadow-lg"
        role="dialog"
        aria-label="알림 허용 안내"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {desktop ? "PC에서 예약 알림 받기" : "예약 알림 받기"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {desktop
                ? "예약 확정·리마인드 푸시 알림을 받으려면 브라우저 알림을 허용해 주세요."
                : "예약 확정·리마인드 등 푸시 알림을 받으려면 알림을 허용해 주세요."}{" "}
              (나중에 브라우저 설정에서 변경할 수 있습니다)
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
