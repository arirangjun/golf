"use client";

import { useCallback, useEffect, useState } from "react";

interface Friend {
  id: string;
  friendUserId: string;
  name: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
}

interface SearchUser {
  id: string;
  name: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
  alreadyFriend: boolean;
}

export function FriendsPanel() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [results, setResults] = useState<SearchUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      if (res.ok) {
        setFriends(data.friends ?? []);
        setError("");
      } else {
        setError(data.error?.message ?? "친구 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dong.trim()) params.set("dong", dong.trim());
      if (ho.trim()) params.set("ho", ho.trim());
      const res = await fetch(`/api/friends/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.users ?? []);
      } else {
        setResults(null);
        setError(data.error?.message ?? "검색에 실패했습니다.");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (user: SearchUser) => {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: user.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "친구 추가에 실패했습니다.");
      return;
    }
    setError("");
    setResults((prev) =>
      prev ? prev.map((item) => (item.id === user.id ? { ...item, alreadyFriend: true } : item)) : prev
    );
    await fetchFriends();
    window.dispatchEvent(new Event("friends-updated"));
  };

  const handleRemove = async (friend: Friend) => {
    if (!confirm(`${friend.unitLabel} ${friend.name}님을 친구에서 삭제할까요?`)) return;
    const res = await fetch(`/api/friends?id=${friend.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "삭제에 실패했습니다.");
      return;
    }
    setFriends((prev) => prev.filter((item) => item.id !== friend.id));
    window.dispatchEvent(new Event("friends-updated"));
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">친구</h2>
      <p className="mb-4 text-sm text-gray-500">
        등록된 회원 중에서 친구를 추가하면 단체 예약에 함께 선택할 수 있습니다.
      </p>

      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={dong}
          onChange={(e) => setDong(e.target.value)}
          placeholder="동"
          required
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        <input
          value={ho}
          onChange={(e) => setHo(e.target.value)}
          placeholder="호수"
          required
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {searching ? "검색 중..." : "검색"}
        </button>
      </form>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {results && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-gray-500">검색 결과</p>
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">일치하는 회원이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border">
              {results.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.unitLabel}</p>
                  </div>
                  <button
                    type="button"
                    disabled={user.alreadyFriend}
                    onClick={() => handleAdd(user)}
                    className="shrink-0 rounded-lg border px-2 py-1 text-xs text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                  >
                    {user.alreadyFriend ? "추가됨" : "친구 추가"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-gray-500">추가된 친구가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {friends.map((friend) => (
            <li key={friend.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{friend.name}</p>
                <p className="text-xs text-gray-500">{friend.unitLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(friend)}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
