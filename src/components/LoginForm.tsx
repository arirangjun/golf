"use client";

import { useAuth } from "./AuthProvider";
import { useState } from "react";

export function LoginForm() {
  const { loginMember, loginAdmin } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isAdminMode) {
        await loginAdmin({ email, password });
      } else {
        await loginMember({ dong, ho, password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">스크린골프 예약</h1>
      <p className="mb-6 text-sm text-gray-500">
        {isAdminMode
          ? "관리자 계정으로 로그인합니다."
          : "관리자가 등록한 회원은 동·호수와 비밀번호로 로그인합니다."}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isAdminMode ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="admin@golf.com"
              required
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">동</label>
              <input
                value={dong}
                onChange={(e) => setDong(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="101"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">호수</label>
              <input
                value={ho}
                onChange={(e) => setHo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="1001"
                required
              />
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder={isAdminMode ? "••••••••" : "1"}
            required
          />
          {!isAdminMode && (
            <p className="mt-1 text-xs text-gray-400">
              같은 동·호수에 여러 명이 있으면 비밀번호로 구분합니다.
            </p>
          )}
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setIsAdminMode(!isAdminMode);
            setError("");
          }}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          {isAdminMode ? "회원 로그인" : "관리자 로그인"}
        </button>
      </div>
      {!isAdminMode && (
        <p className="mt-4 text-center text-xs text-gray-400">
          계정이 없으신 경우 관리자에게 회원 등록을 요청해 주세요.
        </p>
      )}
    </div>
  );
}
