"use client";

import { useCallback, useEffect, useState } from "react";

type NoticeStatus = "SCHEDULED" | "ACTIVE" | "ENDED";

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
  status: NoticeStatus;
  dismissedCount: number;
}

interface FormState {
  title: string;
  content: string;
  startDate: string;
  endDate: string;
}

const STATUS_LABEL: Record<NoticeStatus, { text: string; className: string }> = {
  SCHEDULED: { text: "예정", className: "bg-blue-50 text-blue-700" },
  ACTIVE: { text: "게시중", className: "bg-green-50 text-green-700" },
  ENDED: { text: "종료", className: "bg-gray-100 text-gray-500" },
};

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  const today = todayKst();
  return { title: "", content: "", startDate: today, endDate: today };
}

export function AdminNoticesPanel() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notices");
      const data = await res.json();
      if (res.ok) {
        setItems(data.notices ?? []);
      } else {
        setError(data.error?.message ?? "공지를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (form.endDate < form.startDate) {
      setError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/notices/${editingId}` : "/api/admin/notices",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            content: form.content.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "저장에 실패했습니다.");
        return;
      }
      setMessage(editingId ? "공지가 수정되었습니다." : "공지가 등록되었습니다.");
      resetForm();
      await fetchItems();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: NoticeItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (item: NoticeItem) => {
    if (!confirm(`'${item.title}' 공지를 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/notices/${item.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "삭제에 실패했습니다.");
      return;
    }
    if (editingId === item.id) resetForm();
    setItems((prev) => prev.filter((n) => n.id !== item.id));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          {editingId ? "공지 수정" : "공지 등록"}
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          게시 기간 동안 회원이 접속하면 팝업으로 표시됩니다. 회원이 &quot;다시 보지 않기&quot;를
          체크하면 해당 회원에게는 더 이상 표시되지 않습니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={191}
            placeholder="공지 제목"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            maxLength={5000}
            rows={6}
            placeholder="공지 내용"
            required
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>게시 기간</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
              className="rounded-lg border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-500"
            />
            <span>~</span>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              required
              className="rounded-lg border border-gray-300 px-2 py-1.5 outline-none focus:border-primary-500"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
          )}

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? "저장 중..." : editingId ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">공지 목록</h2>
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const status = STATUS_LABEL[item.status];
              return (
                <li key={item.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.text}
                        </span>
                        <p className="font-medium text-gray-900">{item.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.startDate} ~ {item.endDate} · 다시 보지 않기 {item.dismissedCount}명
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">
                        {item.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-lg border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
