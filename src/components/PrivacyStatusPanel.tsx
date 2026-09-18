"use client";

import { useEffect, useState } from "react";

interface Props {
  friendSearchConsent: boolean;
  privacyConsentAt?: string | null;
  onUpdated: () => Promise<void> | void;
}

export function PrivacyStatusPanel({
  friendSearchConsent,
  privacyConsentAt,
  onUpdated,
}: Props) {
  const [enabled, setEnabled] = useState(friendSearchConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEnabled(friendSearchConsent);
  }, [friendSearchConsent]);

  const handleToggle = async () => {
    if (saving) return;

    const next = !enabled;
    setError("");
    setMessage("");
    setEnabled(next);
    setSaving(true);

    try {
      const res = await fetch("/api/auth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendSearchConsent: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnabled(!next);
        setError(data.error?.message ?? "동의 설정 변경에 실패했습니다.");
        return;
      }
      setMessage(
        next
          ? "선택 동의했습니다. 친구 검색을 이용할 수 있습니다."
          : "선택 동의를 취소했습니다. 친구 검색이 비활성화됩니다."
      );
      await onUpdated();
    } catch {
      setEnabled(!next);
      setError("동의 설정 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">개인정보이용현황</h2>
      <p className="mb-4 text-sm text-gray-500">
        필수 동의 현황을 확인하고, 선택 동의를 바로 켜거나 끌 수 있습니다.
      </p>

      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                개인정보 수집·이용{" "}
                <span className="font-semibold text-red-600">(필수)</span>
              </p>
              <p className="mt-1 text-sm text-green-700">동의 완료</p>
              {privacyConsentAt && (
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(privacyConsentAt).toLocaleString("ko-KR")}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">필수 동의는 철회할 수 없습니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              동의
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                단체 예약을 위한 검색{" "}
                <span className="font-semibold text-gray-600">(선택)</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                동·호수·이름 검색 허용. 동의한 회원만 친구 검색·추가가 가능합니다.
              </p>
              <p
                className={`mt-2 text-sm font-medium ${
                  enabled ? "text-green-700" : "text-gray-500"
                }`}
              >
                {enabled ? "동의함" : "동의 안 함"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="선택 동의 토글"
              disabled={saving}
              onClick={handleToggle}
              className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                enabled ? "bg-primary-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      <details className="mt-5 rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800">
          개인정보 수집·이용 동의서 보기
        </summary>
        <div className="max-h-[40vh] space-y-3 overflow-y-auto border-t border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-700">
          <p>
            본 골프장 예약 서비스(이하 &quot;서비스&quot;)는 회원의 개인정보를 중요하게 보호하며,
            「개인정보 보호법」 등 관련 법령을 준수합니다.
          </p>
          <p>
            <span className="font-medium text-gray-900">선택항목:</span> 친구 추가를 위해
            동·호수·이름 검색을 허용합니다. 선택 동의는 언제든 토글로 변경할 수 있습니다.
          </p>
          <p>
            개인정보 보호책임자: 박경혜/최은하 · 연락처: 070-4943-1589
          </p>
        </div>
      </details>
    </div>
  );
}
