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

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register(swUrl, { scope })
      .then((registration) => registration.update())
      .catch(console.error);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [pathname]);

  return null;
}
