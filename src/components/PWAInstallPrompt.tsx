"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const storageKey = isAdmin ? "pwa-install-dismissed-admin" : "pwa-install-dismissed-member";

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(storageKey) === "1") return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Chrome 외 브라우저: 이벤트 없어도 안내 배너 표시
    const timer = window.setTimeout(() => {
      setVisible((current) => current || true);
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
    setDeferred(null);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    localStorage.setItem(storageKey, "1");
  };

  if (!visible) return null;

  const appName = isAdmin ? "골프관리" : "골프예약";
  const accent = isAdmin
    ? "border-teal-200 bg-teal-50 text-teal-950"
    : "border-primary-200 bg-primary-50 text-primary-950";
  const buttonClass = isAdmin
    ? "bg-teal-700 hover:bg-teal-800"
    : "bg-primary-600 hover:bg-primary-700";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-lg ${accent}`}
        role="dialog"
        aria-label="앱 설치 안내"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{appName} 앱으로 설치</p>
            {iosHint ? (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                Safari 하단 <span className="font-semibold">공유</span> →{" "}
                <span className="font-semibold">홈 화면에 추가</span>를 눌러 설치하세요.
              </p>
            ) : deferred ? (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있습니다.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                브라우저 메뉴의 <span className="font-semibold">홈 화면에 추가</span> 또는{" "}
                <span className="font-semibold">앱 설치</span>를 선택하세요.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg px-2 py-1 text-xs opacity-60 hover:opacity-100"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        {!iosHint && deferred && (
          <button
            type="button"
            onClick={install}
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-white ${buttonClass}`}
          >
            설치하기
          </button>
        )}
      </div>
    </div>
  );
}
