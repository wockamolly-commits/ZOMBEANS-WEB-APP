"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/browser";

const FALLBACK_REFRESH_MS = 8_000;

export function RiderLiveUpdater({ riderProfileId }: { riderProfileId: string }) {
  const router = useRouter();
  const refreshQueued = useRef(false);
  const realtimeReady = useRef(false);

  useEffect(() => {
    let interval: number | undefined;
    const supabase = createAdminClient();

    const refreshSoon = () => {
      if (refreshQueued.current) return;
      refreshQueued.current = true;
      window.setTimeout(() => {
        refreshQueued.current = false;
        router.refresh();
      }, 250);
    };

    const startFallback = () => {
      if (interval !== undefined) return;
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, FALLBACK_REFRESH_MS);
    };

    const stopFallback = () => {
      if (interval === undefined) return;
      window.clearInterval(interval);
      interval = undefined;
    };

    const channel = supabase
      .channel(`rider-dashboard:${riderProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_assignments",
          filter: `rider_profile_id=eq.${riderProfileId}`,
        },
        refreshSoon
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_notifications",
          filter: `rider_profile_id=eq.${riderProfileId}`,
        },
        refreshSoon
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeReady.current = true;
          stopFallback();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeReady.current = false;
          startFallback();
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        if (!realtimeReady.current) startFallback();
      } else {
        stopFallback();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopFallback();
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [riderProfileId, router]);

  return null;
}
