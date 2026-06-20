"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000;

/**
 * Keeps the operational board current without disturbing scroll or local
 * interaction state. Polling pauses in background tabs and refreshes
 * immediately when staff return to the board.
 */
export function AdminOrdersPoller() {
  const router = useRouter();

  useEffect(() => {
    let interval: number | undefined;

    const start = () => {
      if (interval !== undefined) return;
      interval = window.setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (interval === undefined) return;
      window.clearInterval(interval);
      interval = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}