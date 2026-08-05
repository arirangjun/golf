"use client";

import { useAuth } from "@/components/AuthProvider";
import { LoginForm } from "@/components/LoginForm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export function AdminPageClient() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 p-4">
        <LoginForm mode="admin" />
      </div>
    );
  }

  return <AdminDashboard />;
}
