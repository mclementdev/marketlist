"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production uniquement) pour l'installation et le hors-ligne. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sans service worker, l'app fonctionne normalement en ligne.
    });
  }, []);
  return null;
}
