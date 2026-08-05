"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PWARegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isAdmin = pathname.startsWith("/admin");
    const swUrl = isAdmin ? "/admin/sw.js" : "/sw.js";
    const scope = isAdmin ? "/admin" : "/";

    navigator.serviceWorker.register(swUrl, { scope }).catch(console.error);
  }, [pathname]);

  return null;
}
