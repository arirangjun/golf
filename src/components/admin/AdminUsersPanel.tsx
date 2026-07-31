"use client";

import { useState, useEffect, useCallback } from "react";
import { Role } from "@prisma/client";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  dong: string;
  ho: string;
  unitLabel: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  reservationCount: number;
}

const emptyForm = {
  name: "",
  dong: "",
  ho: "",
};

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    dong: "",
    ho: "",
    password: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);

  const downloadTemplate = () => {
    window.open("/api/admin/users/template", "_blank");
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);
    setImportErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/users/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      if (data.users?.length) {
        setUsers((prev) => [...data.users, ...prev]);
      }
      setMessage({
        type: data.errors?.length ? "error" : "success",
        text: `엑셀 등록 완료: ${data.created}명 등록, ${data.skipped}명 건너뜀`,
      });
      setImportErrors(data.errors ?? []);
    } else {
      setMessage({ type: "error", text: data.error?.message ?? "엑셀 등록 실패" });
    }

    setImporting(false);
    e.target.value = "";
  };

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (res.ok) {
      setUsers((prev) => [data.user, ...prev]);
      setForm(emptyForm);
      setMessage({
        type: "success",
        text: "회원이 등록되었습니다. 동·호수 / 비밀번호(1)로 로그인할 수 있습니다.",
      });
    } else {
      setMessage({ type: "error", text: data.error?.message ?? "등록 실패" });
    }
    setCreating(false);
  };

  const updateUser = async (
    id: string,
    patch: {
      role?: Role;
      isActive?: boolean;
      name?: string;
      dong?: string;
      ho?: string;
      password?: string;
    }
  ) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...data.user } : u))
      );
      return true;
    }
    alert(data.error?.message ?? "변경 실패");
    return false;
  };

  const openEdit = (user: AdminUser) => {
    setEditId(user.id);
    setEditForm({
      name: user.name,
      dong: user.dong,
      ho: user.ho,
      password: "",
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    const patch: Record<string, string> = {
      name: editForm.name,
      dong: editForm.dong,
      ho: editForm.ho,
    };
    if (editForm.password) patch.password = editForm.password;

    const ok = await updateUser(editId, patch);
    if (ok) {
      setEditId(null);
      setMessage({ type: "success", text: "회원 정보가 수정되었습니다." });
    }
  };

  const members = users.filter((u) => u.role === "USER");
  const admins = users.filter((u) => u.role === "ADMIN");

  if (loading) return <p className="text-gray-500">로딩 중...</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold text-gray-900">회원 등록</h3>
        <p className="mb-4 text-xs text-gray-500">
          동·호수로 로그인합니다. 초기 비밀번호는 모두 <strong>1</strong>입니다.
        </p>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">동</label>
            <input
              value={form.dong}
              onChange={(e) => setForm({ ...form, dong: e.target.value })}
              placeholder="101"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">호수</label>
            <input
              value={form.ho}
              onChange={(e) => setForm({ ...form, ho: e.target.value })}
              placeholder="1001"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">이름</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? "등록 중..." : "회원 등록"}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t pt-6">
          <h4 className="mb-1 text-sm font-semibold text-gray-900">엑셀 일괄 등록</h4>
          <p className="mb-3 text-xs text-gray-500">
            양식: <strong>동 · 호수 · 이름</strong> (초기 비밀번호 1 자동 설정)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              양식 다운로드
            </button>
            <label className="cursor-pointer rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              {importing ? "등록 중..." : "엑셀 파일 선택"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importing}
                onChange={handleExcelImport}
              />
            </label>
          </div>
          {importErrors.length > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
              {importErrors.map((err) => (
                <p key={`${err.row}-${err.message}`}>
                  {err.row}행: {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-gray-900">등록 회원 목록</h3>
          <p className="text-xs text-gray-500">
            활성 {members.filter((m) => m.isActive).length}명 / 전체 {members.length}명
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">동/호수</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">예약 수</th>
              <th className="px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  등록된 회원이 없습니다. 위에서 회원을 등록해 주세요.
                </td>
              </tr>
            ) : (
              members.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{user.unitLabel}</td>
                  <td className="px-4 py-3">{user.displayName.replace(/^[^\s]+\s/, "")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{user.reservationCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() =>
                          updateUser(user.id, { isActive: !user.isActive })
                        }
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        {user.isActive ? "비활성화" : "활성화"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {admins.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-gray-900">관리자 계정</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">이메일 (로그인)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {admins.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-semibold text-gray-900">회원 정보 수정</h3>
            <form onSubmit={handleEditSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">동</label>
                  <input
                    value={editForm.dong}
                    onChange={(e) => setEditForm({ ...editForm, dong: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">호수</label>
                  <input
                    value={editForm.ho}
                    onChange={(e) => setEditForm({ ...editForm, ho: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">이름</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  새 비밀번호 (변경 시에만 입력)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="미입력 시 유지"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditId(null)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
