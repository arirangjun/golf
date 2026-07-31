"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Role } from "@prisma/client";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface MemberLoginInput {
  dong: string;
  ho: string;
  password: string;
}

interface AdminLoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginMember: (input: MemberLoginInput) => Promise<void>;
  loginAdmin: (input: AdminLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginMember = async ({ dong, ho, password }: MemberLoginInput) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dong, ho, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message ?? "로그인 실패");
    }
    setUser(data.user);
  };

  const loginAdmin = async ({ email, password }: AdminLoginInput) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginType: "admin", email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message ?? "로그인 실패");
    }
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginMember, loginAdmin, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
