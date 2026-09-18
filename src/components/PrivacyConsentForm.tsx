"use client";

import { useEffect, useState } from "react";

interface ConsentFormProps {
  mode: "gate" | "settings";
  initialFriendSearchConsent?: boolean;
  onSaved: (user: {
    privacyConsented: boolean;
    privacyConsentAt: string | null;
    friendSearchConsent: boolean;
  }) => void;
}

export function PrivacyConsentForm({
  mode,
  initialFriendSearchConsent = false,
  onSaved,
}: ConsentFormProps) {
  const [privacyConsent, setPrivacyConsent] = useState(mode === "settings");
  const [friendSearchConsent, setFriendSearchConsent] = useState(initialFriendSearchConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFriendSearchConsent(initialFriendSearchConsent);
  }, [initialFriendSearchConsent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (mode === "gate" && !privacyConsent) {
      setError("필수 개인정보 수집·이용에 동의해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, boolean> = {
        friendSearchConsent,
      };
      if (mode === "gate") {
        body.privacyConsent = true;
      }

      const res = await fetch("/api/auth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "저장에 실패했습니다.");
        return;
      }
      onSaved(data.user);
      if (mode === "settings") {
        setMessage("동의 설정이 저장되었습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "gate" && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">개인정보 수집·이용 동의서</h2>
          <p className="mt-1 text-sm text-gray-500">
            서비스 이용을 위해 아래 내용을 확인한 뒤 동의해 주세요.
          </p>
        </div>
      )}

      <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
        <p>
          본 골프장 예약 서비스(이하 &quot;서비스&quot;)는 회원의 개인정보를 중요하게 보호하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다.
        </p>
        <p>
          회원은 골프장 예약 및 서비스 이용을 위하여 아래와 같이 개인정보를 수집·이용하는
          것에 동의합니다.
        </p>

        <section>
          <h3 className="font-semibold text-gray-900">1. 개인정보 수집·이용 목적</h3>
          <p className="mt-1">수집한 개인정보는 다음의 목적을 위해 이용됩니다.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>회원 가입 및 본인 확인</li>
            <li>골프장 예약, 예약 변경 및 예약 취소 처리</li>
            <li>예약 내역 및 이용 내역 관리</li>
            <li>골프장 이용 관련 안내 및 공지사항 전달</li>
            <li>서비스 이용에 따른 문의 및 민원 처리</li>
            <li>부정 이용 및 비정상적인 예약 방지</li>
            <li>서비스 개선 및 이용 통계 분석</li>
          </ol>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">2. 수집하는 개인정보 항목</h3>
          <p className="mt-2 font-medium text-gray-800">필수항목</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>성명</li>
            <li>휴대전화번호</li>
            <li>아이디 및 비밀번호</li>
            <li>골프장 예약에 필요한 회원정보</li>
            <li>서비스 이용기록 및 예약기록</li>
          </ul>
          <p className="mt-3 font-medium text-gray-800">선택항목</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>친구 추가를 위해 동·호수·이름 검색을 허용</li>
            <li>기타 회원이 서비스 이용 과정에서 자발적으로 제공하는 정보</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            ※ 서비스 이용 과정에서 접속기록, IP주소, 기기정보, 쿠키 등의 정보가 자동으로
            생성·수집될 수 있습니다.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">3. 개인정보의 보유 및 이용기간</h3>
          <p className="mt-1">
            회원의 개인정보는 원칙적으로{" "}
            <span className="font-semibold text-gray-900">회원 탈퇴 시까지</span> 보유·이용합니다.
          </p>
          <p className="mt-2">
            다만, 관계 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 법령에서 정한 기간
            동안 보관합니다.
          </p>
          <p className="mt-2">
            회원 탈퇴 후에도 관계 법령에 따라 보존할 필요가 있는 개인정보는 해당 기간 동안
            안전하게 보관한 후 지체 없이 파기합니다.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">4. 개인정보의 제3자 제공</h3>
          <p className="mt-1">
            서비스 운영을 위해 필요한 경우를 제외하고 회원의 개인정보를 회원의 동의 없이
            제3자에게 제공하지 않습니다.
          </p>
          <p className="mt-2">다만, 다음의 경우에는 예외로 합니다.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>회원이 사전에 동의한 경우</li>
            <li>법령에 특별한 규정이 있는 경우</li>
            <li>수사기관 등 관계기관이 법령에 따라 적법하게 요청하는 경우</li>
          </ol>
          <p className="mt-2">
            골프장 예약 처리를 위해 골프장 등 제휴기관에 개인정보를 제공하는 경우에는
            제공받는 자, 제공 목적, 제공 항목 및 보유기간을 별도로 안내하고 필요한 경우
            회원의 동의를 받습니다.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">5. 개인정보 처리의 위탁</h3>
          <p className="mt-1">
            서비스의 원활한 운영을 위하여 개인정보 처리 업무를 외부 전문업체에 위탁할 수
            있습니다.
          </p>
          <p className="mt-2">
            개인정보 처리 위탁이 발생하는 경우 위탁받는 업체와 위탁업무의 내용을
            개인정보처리방침 등을 통해 공개하고 관련 법령에 따라 안전하게 관리합니다.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">6. 동의 거부권 및 불이익</h3>
          <p className="mt-1">회원은 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.</p>
          <p className="mt-2">
            다만,{" "}
            <span className="font-semibold text-gray-900">
              필수 개인정보의 수집·이용에 동의하지 않을 경우 회원가입 또는 골프장 예약 등
              서비스 이용이 제한될 수 있습니다.
            </span>
          </p>
          <p className="mt-2">
            선택항목에 대한 동의는 거부할 수 있으며, 선택항목에 동의하지 않더라도 기본적인
            서비스 이용에는 제한이 없습니다.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900">개인정보 보호책임자</h3>
          <p className="mt-1">
            개인정보와 관련한 문의, 열람·정정·삭제·처리정지 요청 등은 아래 담당자에게 문의할
            수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>개인정보 보호책임자: 박경혜/최은하</li>
            <li>연락처: 070-4943-1589</li>
          </ul>
        </section>

        <p className="border-t border-gray-200 pt-3 text-gray-800">
          본인은 위 개인정보 수집·이용에 관한 내용을 충분히 확인하였으며, 이에 동의합니다.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <input
          type="checkbox"
          checked={mode === "settings" ? true : privacyConsent}
          disabled={mode === "settings"}
          onChange={(e) => setPrivacyConsent(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-gray-800">
          개인정보 수집·이용에 동의합니다.{" "}
          <span className="font-semibold text-red-600">(필수)</span>
          {mode === "settings" && (
            <span className="mt-1 block text-xs text-gray-500">필수 동의는 철회할 수 없습니다.</span>
          )}
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <input
          type="checkbox"
          checked={friendSearchConsent}
          onChange={(e) => setFriendSearchConsent(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-gray-800">
          선택 단체 예약을 위한 검색 및 개인정보 수집·이용에 동의합니다.{" "}
          <span className="font-semibold text-gray-600">(선택)</span>
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {saving ? "저장 중..." : mode === "gate" ? "동의하고 시작하기" : "동의 설정 저장"}
      </button>
    </form>
  );
}
