"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/browser";

// Realtime is the primary update path; polling is a safety net for dropped
// sockets and backgrounded tabs.
const FALLBACK_POLL_MS = 20_000;
const REFRESH_DEBOUNCE_MS = 250;

/**
 * Keeps the operational board current in real time. Subscribes to Supabase
 * Realtime for order and rider-assignment changes so staff see a delivery jump
 * to "Out for delivery" the instant the assigned rider confirms pickup — no
 * manual refresh. Falls back to polling when the socket drops, and refreshes
 * immediately when staff return to a backgrounded tab. Staff RLS already scopes
 * what these subscriptions can read.
 */
export function AdminOrdersPoller() {
  const router = useRouter();
  const refreshTimer = useRef<number | undefined>(undefined);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  // ---- realtime: orders + rider assignments ----
  useEffect(() => {
    const supabase: SupabaseClient = createAdminClient();
    const channel = supabase
      .channel("admin-orders-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_assignments" },
        () => scheduleRefresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  // ---- fallback: poll + catch up on focus ----
  useEffect(() => {
    let interval: number | undefined;
    const start = () => {
      if (interval === undefined) {
        interval = window.setInterval(() => router.refresh(), FALLBACK_POLL_MS);
      }
    };
    const stop = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
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

  // Clean up the debounce timer on unmount.
  useEffect(
    () => () => {
      if (refreshTimer.current !== undefined) {
        window.clearTimeout(refreshTimer.current);
      }
    },
    []
  );

  return null;
}
