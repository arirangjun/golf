"use client";

import { useEffect, useState } from "react";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PWAInstallButton({ placement = "floating" }: { placement?: "floating" | "header" }) {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  if (standalone) return null;

  const className =
    placement === "header"
      ? "inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 [@media(display-mode:standalone)]:hidden"
      : "absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-20 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 [@media(display-mode:standalone)]:hidden";

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("pwa-install-request"))}
      className={className}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M10.75 2.75a.75.75 0 00-1.5 0v6.69L7.03 7.22a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l3.5-3.5a.75.75 0 00-1.06-1.06l-2.22 2.22V2.75z" />
        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
      </svg>
      전용앱설치
    </button>
  );
}
