"use client";

import { useEffect, useState } from "react";

interface Notice {
  id: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
}

const SESSION_KEY = "golf-notice-closed";

function readClosedThisSession(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function markClosedThisSession(id: string) {
  try {
    const ids = new Set(readClosedThisSession());
    ids.add(id);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage unavailable
  }
}

export function NoticePopup() {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notices/active");
        if (!res.ok) return;
        const data = await res.json();
        const closed = new Set(readClosedThisSession());
        const notices: Notice[] = (data.notices ?? []).filter((n: Notice) => !closed.has(n.id));
        if (!cancelled) setQueue(notices);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      if (dontShowAgain) {
        await fetch(`/api/notices/${current.id}/dismiss`, { method: "POST" }).catch(() => null);
      }
      markClosedThisSession(current.id);
      setDontShowAgain(false);
      setQueue((prev) => prev.slice(1));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-popup-title"
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-lg"
      >
        <div className="border-b px-6 py-4">
          <p className="text-xs font-medium text-primary-600">
            공지사항{queue.length > 1 ? ` (1/${queue.length})` : ""}
          </p>
          <h2 id="notice-popup-title" className="mt-1 text-lg font-semibold text-gray-900">
            {current.title}
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            {current.startDate} ~ {current.endDate}
          </p>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {current.content}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            확인했습니다. 다시 보지 않기
          </label>
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
