"use client";

import {
  BellRing,
  RefreshCw,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRiderAlerts } from "@/components/rider/RiderAlertsProvider";

/**
 * Deliveries-header controls for the global rider-alert system. The live
 * subscription, sound, and popups live in RiderAlertsProvider (rider layout);
 * this just surfaces connection state plus the mute / refresh affordances.
 */
export function RiderLiveControls() {
  const { conn, soundOn, audioReady, pendingRefresh, setSound, enableSound, refreshNow } =
    useRiderAlerts();

  const needsSoundTap = soundOn && !audioReady;

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
            conn === "live"
              ? "border-zb-sage/35 bg-zb-primary-strong text-zb-cream/80"
              : "border-zb-bone/40 bg-zb-bone/10 text-zb-bone"
          }`}
          aria-live="polite"
        >
          {conn === "live" ? (
            <>
              <span className="zb-live-dot inline-block size-2 rounded-full bg-emerald-400" />
              <Wifi className="size-3.5" aria-hidden />
              Live
            </>
          ) : (
            <>
              <WifiOff className="size-3.5" aria-hidden />
              {conn === "connecting" ? "Connecting" : "Reconnecting"}
            </>
          )}
        </span>

        <button
          type="button"
          onClick={() => setSound(!soundOn)}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Mute new-delivery alerts" : "Unmute new-delivery alerts"}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zb-sage/30 bg-zb-primary-strong text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream"
        >
          {soundOn ? (
            <Volume2 className="size-4 text-zb-bone" aria-hidden />
          ) : (
            <VolumeX className="size-4" aria-hidden />
          )}
        </button>

        <button
          type="button"
          disabled={pendingRefresh}
          onClick={refreshNow}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zb-sage/30 bg-zb-primary-strong px-3 text-xs font-semibold text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream disabled:cursor-wait disabled:opacity-65"
          aria-label="Refresh deliveries"
        >
          <RefreshCw
            className={`size-4 text-zb-bone ${pendingRefresh ? "animate-spin" : ""}`}
            aria-hidden
          />
          <span>{pendingRefresh ? "Updating" : "Refresh"}</span>
        </button>
      </div>

      {needsSoundTap && (
        <button
          type="button"
          onClick={enableSound}
          className="zb-reveal mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zb-bone/45 bg-zb-bone/10 px-3 py-2 text-xs font-semibold text-zb-bone transition hover:bg-zb-bone/15"
        >
          <BellRing className="size-4" aria-hidden />
          Tap to enable alert sound
        </button>
      )}
    </>
  );
}
