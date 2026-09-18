"use client";

import { PrivacyConsentForm } from "@/components/PrivacyConsentForm";

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
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">개인정보이용현황</h2>
      <p className="mb-4 text-sm text-gray-500">
        필수 동의 현황을 확인하고, 친구 검색(선택) 동의를 변경할 수 있습니다.
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">(필수) 개인정보 수집·이용</p>
          <p className="mt-1 text-sm font-medium text-green-700">동의 완료</p>
          {privacyConsentAt && (
            <p className="mt-1 text-xs text-gray-400">
              {new Date(privacyConsentAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">(선택) 단체 예약 검색</p>
          <p
            className={`mt-1 text-sm font-medium ${
              friendSearchConsent ? "text-green-700" : "text-gray-500"
            }`}
          >
            {friendSearchConsent ? "동의함" : "동의 안 함"}
          </p>
        </div>
      </div>

      <PrivacyConsentForm
        mode="settings"
        initialFriendSearchConsent={friendSearchConsent}
        onSaved={async () => {
          await onUpdated();
        }}
      />
    </div>
  );
}
