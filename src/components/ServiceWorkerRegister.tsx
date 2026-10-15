"use client";

import { useEffect } from "react";

// Production seulement : en dev, le cache gênerait le rechargement à chaud.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);
  return null;
}
