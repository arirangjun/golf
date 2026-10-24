"use client";

import { useCallback, useEffect, useState } from "react";
import { VoteResultBars, type VoteResults } from "@/components/VoteResultBars";

interface AdminVoteStatus {
  open: boolean;
  startDate: string;
  endDate: string;
  activeMembers: number;
  results: VoteResults;
}

export function AdminVotePanel() {
  const [status, setStatus] = useState<AdminVoteStatus | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/votes/app-intro/admin");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "투표 현황을 불러오지 못했습니다.");
      return;
    }
    setStatus(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!status) return <p className="text-sm text-gray-500">로딩 중...</p>;

  const participation =
    status.activeMembers > 0
      ? Math.round((status.results.total / status.activeMembers) * 100)
      : 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">골프예약 어플 도입 투표</h2>
          <p className="mt-1 text-sm text-gray-500">
            {status.startDate} ~ {status.endDate} · {status.open ? "진행 중" : "종료"} · 회원당 1표
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-700">
        참여 {status.results.total}명 / 활성 회원 {status.activeMembers}명 ({participation}%)
      </p>
      <VoteResultBars results={status.results} />
    </div>
  );
}
