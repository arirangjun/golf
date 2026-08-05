"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InAppKind = "kakaotalk" | "naver" | "instagram" | "facebook" | "line" | "other" | null;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const mobile = /android|iphone|ipad|ipod|mobile|windows phone/i.test(ua);
  return !mobile && window.matchMedia("(pointer: fine)").matches;
}

function detectInAppBrowser(): InAppKind {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("kakaotalk")) return "kakaotalk";
  if (ua.includes("naver") && (ua.includes("inapp") || ua.includes("naver("))) return "naver";
  if (ua.includes("instagram")) return "instagram";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) return "facebook";
  if (ua.includes("line/")) return "line";
  if (ua.includes("; wv)") || ua.includes("webview")) return "other";
  return null;
}

function inAppLabel(kind: InAppKind): string {
  switch (kind) {
    case "kakaotalk":
      return "카카오톡";
    case "naver":
      return "네이버";
    case "instagram":
      return "인스타그램";
    case "facebook":
      return "페이스북";
    case "line":
      return "라인";
    default:
      return "앱 내 브라우저";
  }
}

function openInExternalBrowser() {
  const url = window.location.href;
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("kakaotalk")) {
    if (isIos()) {
      void navigator.clipboard?.writeText(url);
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    const hostPath = url.replace(/^https?:\/\//, "");
    window.location.href =
      `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return;
  }

  void navigator.clipboard?.writeText(url);
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const storageKey = isAdmin ? "pwa-install-dismissed-admin" : "pwa-install-dismissed-member";

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [inApp, setInApp] = useState<InAppKind>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(storageKey) === "1") return;

    const desktopEnv = isDesktop();
    setDesktop(desktopEnv);

    const inAppKind = detectInAppBrowser();
    if (inAppKind) {
      setInApp(inAppKind);
      setVisible(true);
      return;
    }

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

    // PC는 더 빨리 안내 (Chrome/Edge 설치 가능)
    const delayMs = desktopEnv ? 800 : 2500;
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
    setDeferred(null);
    if (!isAdmin) {
      window.dispatchEvent(new CustomEvent("pwa-install-dismissed"));
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    localStorage.setItem(storageKey, "1");
    if (!isAdmin) {
      window.dispatchEvent(new CustomEvent("pwa-install-dismissed"));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!visible) return null;

  const appName = isAdmin ? "골프관리" : "골프예약";
  const accent = isAdmin
    ? "border-teal-200 bg-teal-50 text-teal-950"
    : "border-primary-200 bg-primary-50 text-primary-950";
  const buttonClass = isAdmin
    ? "bg-teal-700 hover:bg-teal-800"
    : "bg-primary-600 hover:bg-primary-700";

  const shellClass = desktop
    ? "pointer-events-none fixed bottom-6 right-6 z-50 flex justify-end p-0"
    : "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4";

  if (inApp) {
    const name = inAppLabel(inApp);
    return (
      <div className={shellClass}>
        <div
          className={`pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-lg ${accent}`}
          role="dialog"
          aria-label="외부 브라우저 안내"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{appName} 설치 안내</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                지금 {name} 안의 브라우저로 열려 있어 앱 설치가 되지 않습니다.
                <br />
                {isIos() ? (
                  <>
                    우측 상단 <span className="font-semibold">⋯</span> →{" "}
                    <span className="font-semibold">Safari로 열기</span> 후 홈 화면에 추가하세요.
                  </>
                ) : (
                  <>
                    우측 상단 <span className="font-semibold">⋯</span> →{" "}
                    <span className="font-semibold">다른 브라우저로 열기</span> (Chrome 등) 후
                    설치하세요.
                  </>
                )}
              </p>
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
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={openInExternalBrowser}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white ${buttonClass}`}
            >
              외부 브라우저로 열기
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm font-medium"
            >
              {copied ? "복사됨" : "링크 복사"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-lg ${accent}`}
        role="dialog"
        aria-label="앱 설치 안내"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {desktop ? `${appName} PC 앱으로 설치` : `${appName} 앱으로 설치`}
            </p>
            {iosHint ? (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                Safari 하단 <span className="font-semibold">공유</span> →{" "}
                <span className="font-semibold">홈 화면에 추가</span>를 눌러 설치하세요.
              </p>
            ) : desktop && deferred ? (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                설치하면 작업 표시줄·시작 메뉴에서 바로 실행할 수 있습니다.
              </p>
            ) : desktop ? (
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                Chrome/Edge 주소창 오른쪽 <span className="font-semibold">설치 아이콘(⊕)</span>을
                누르거나, 메뉴 → <span className="font-semibold">앱 설치</span>를 선택하세요.
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
            {desktop ? "PC에 설치하기" : "설치하기"}
          </button>
        )}
      </div>
    </div>
  );
}
