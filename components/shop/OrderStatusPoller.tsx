"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000;

/**
 * Headless live-status updater for the order tracking page.
 * The page is `force-dynamic`, so router.refresh() re-runs the server
 * component (re-calling get_order_by_code) and merges the fresh status
 * without losing scroll or client state. Polling pauses while the tab is
 * hidden and stops entirely once the order reaches a terminal status.
 */
export function OrderStatusPoller({ terminal }: { terminal: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (terminal) return;

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
  }, [terminal, router]);

  return null;
}
