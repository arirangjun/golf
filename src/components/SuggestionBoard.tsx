"use client";

import { useCallback, useEffect, useState } from "react";

interface SuggestionItem {
  id: string;
  content: string;
  createdAt: string;
  authorDisplay: string;
  isMine: boolean;
  canDelete: boolean;
}

function formatWhen(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function SuggestionBoard() {
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions");
      const data = await res.json();
      if (res.ok) {
        setItems(data.suggestions ?? []);
        setError("");
      } else {
        setError(data.error?.message ?? "건의를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setContent("");
        await fetchItems();
      } else {
        setError(data.error?.message ?? "건의 등록에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 건의를 삭제할까요?")) return;
    const res = await fetch(`/api/suggestions?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setError(data.error?.message ?? "삭제에 실패했습니다.");
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">건의 게시판</h2>
      <p className="mb-4 text-sm text-gray-500">모든 회원이 볼 수 있습니다. 시설·운영 관련 의견을 남겨 주세요.</p>

      <form onSubmit={handleSubmit} className="mb-5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="건의 내용을 입력하세요"
          className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{content.length}/1000</span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 건의가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm text-gray-900">{item.content}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.authorDisplay}
                    {item.isMine ? " · 내 글" : ""}
                    {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ""}
                  </p>
                </div>
                {item.canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}