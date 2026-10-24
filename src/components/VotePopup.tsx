"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VoteResultBars, type VoteResults } from "@/components/VoteResultBars";

type Choice = "AGREE" | "DISAGREE" | "UNSURE";

interface VoteStatus {
  open: boolean;
  startDate: string;
  endDate: string;
  voted: boolean;
  myChoice: Choice | null;
  results: VoteResults;
}

const SESSION_KEY = "golf-vote-later";

function isVotePeriodNow() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return today >= "2026-10-24" && today <= "2026-10-29";
}

const OPTIONS: { id: Choice; title: string; text: string }[] = [
  {
    id: "AGREE",
    title: "찬성",
    text: "월 서버 유지비용이 발생하더라도 예약 편의성과 관리 효율성을 위해 골프예약 어플 도입에 찬성합니다.",
  },
  {
    id: "DISAGREE",
    title: "반대",
    text: "별도의 서버 유지비용이 발생하므로 기존 예약 방식을 유지하는 것에 찬성합니다.",
  },
  {
    id: "UNSURE",
    title: "모르겠다",
    text: "아직 판단하기 어렵습니다.",
  },
];

export function VotePopup() {
  const [status, setStatus] = useState<VoteStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/votes/app-intro", { cache: "no-store" });
      if (!res.ok) {
        setError("투표 정보를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.");
        return;
      }
      const data = (await res.json()) as VoteStatus;
      setStatus(data);
      setChoice(data.myChoice);
      setError("");
    } catch {
      setError("투표 정보를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.");
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
    try {
      setHidden(sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      // sessionStorage unavailable
    }
  }, [load]);

  if (!mounted || hidden) return null;
  if (status && !status.open) return null;
  if (status?.voted && !justVoted) return null;
  if (!status && !isVotePeriodNow()) return null;

  const submit = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/votes/app-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "투표에 실패했습니다.");
        if (data.error?.code === "ALREADY_VOTED") await load();
        return;
      }
      setStatus(data);
      setChoice(data.myChoice);
      setJustVoted(true);
      window.dispatchEvent(new Event("golf-vote-updated"));
    } finally {
      setSaving(false);
    }
  };

  const later = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    setHidden(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex h-[100dvh] items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vote-popup-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-lg"
      >
        <div className="border-b px-6 py-4">
          <p className="text-xs font-medium text-primary-600">회원 투표 · 1인 1표</p>
          <h2 id="vote-popup-title" className="mt-1 text-lg font-semibold text-gray-900">
            골프예약 어플 도입에 관한 회원 찬반투표
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            {status ? `${status.startDate} ~ ${status.endDate}` : "2026-10-24 ~ 2026-10-29"}
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4 text-sm leading-relaxed text-gray-700">
          <p>회원 여러분께 안내드립니다.</p>
          <p>
            골프장 예약의 편의성을 높이고 예약 현황을 보다 효율적으로 관리하기 위하여{" "}
            <span className="font-semibold text-gray-900">골프예약 어플 도입</span>에 대한 회원
            여러분의 의견을 수렴하고자 합니다.
          </p>
          <p>
            어플 운영 시 서버 유지비용으로{" "}
            <span className="font-semibold text-gray-900">
              월 약 2~3만 원(연간 약 24~36만 원)
            </span>
            이 발생할 것으로 예상됩니다.
          </p>
          <p>
            이에 비용과 편의성을 함께 고려하여 어플 도입 여부를 결정하고자 하오니, 회원
            여러분께서는 아래 내용을 확인하시고 투표에 참여해 주시기 바랍니다.
          </p>
          <div>
            <p className="font-semibold text-gray-900">1. 투표 안건</p>
            <p>골프예약 어플 도입 여부</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">2. 투표 기간</p>
            <p>2026년 10월 24일(토) ~ 10월 29일(목)</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">3. 투표 항목</p>
            {OPTIONS.map((option, index) => (
              <label
                key={option.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  status?.voted ? "cursor-default" : "cursor-pointer"
                } ${choice === option.id ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}
              >
                <input
                  type="radio"
                  name="app-intro-vote"
                  checked={choice === option.id}
                  disabled={Boolean(status?.voted)}
                  onChange={() => setChoice(option.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-900">
                    {["①", "②", "③"][index]} {option.title}
                  </span>
                  <span className="mt-1 block text-gray-600">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
          <p>회원 여러분의 소중한 의견을 바탕으로 합리적으로 결정하겠습니다.</p>
          <p className="font-semibold text-gray-900">투표 기간 내 적극적인 참여를 부탁드립니다.</p>
          <p>감사합니다.</p>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {status?.voted && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              투표가 완료되었습니다. 회원당 1회만 참여할 수 있습니다.
            </p>
          )}

          {status && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <VoteResultBars results={status.results} />
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t px-6 py-4">
          {status?.voted ? (
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              확인
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={later}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!choice || saving}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? "저장 중..." : "투표하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function VoteStatusCard() {
  const [status, setStatus] = useState<VoteStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/votes/app-intro");
        if (!res.ok) return;
        const data = (await res.json()) as VoteStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // ignore
      }
    };
    load();
    const onUpdated = () => load();
    window.addEventListener("golf-vote-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("golf-vote-updated", onUpdated);
    };
  }, []);

  if (!status?.open) return null;

  const mine = OPTIONS.find((option) => option.id === status.myChoice);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">골프예약 어플 도입 투표</h2>
      <p className="mt-1 text-xs text-gray-500">
        {status.startDate} ~ {status.endDate}
        {mine ? ` · 내 투표: ${mine.title}` : " · 아직 투표하지 않았습니다"}
      </p>
      <div className="mt-4">
        <VoteResultBars results={status.results} />
      </div>
    </div>
  );
}
