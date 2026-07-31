"use client";

import { useAuth } from "@/components/AuthProvider";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return <AdminDashboard />;
}
