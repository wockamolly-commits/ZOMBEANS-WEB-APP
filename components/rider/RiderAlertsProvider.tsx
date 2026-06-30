"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/browser";

type ConnState = "connecting" | "live" | "reconnecting";

type RiderAlertsValue = {
  conn: ConnState;
  soundOn: boolean;
  audioReady: boolean;
  pendingRefresh: boolean;
  setSound: (on: boolean) => void;
  enableSound: () => void;
  refreshNow: () => void;
};

const RiderAlertsContext = createContext<RiderAlertsValue | null>(null);

/** Read the live rider-alert state. Must be used under <RiderAlertsProvider>. */
export function useRiderAlerts(): RiderAlertsValue {
  const ctx = useContext(RiderAlertsContext);
  if (!ctx) {
    throw new Error("useRiderAlerts must be used within RiderAlertsProvider");
  }
  return ctx;
}

const SOUND_PREF_KEY = "zb-rider-sound";
const FALLBACK_POLL_MS = 15_000;
const ALERT_SNAPSHOT_MS = 5_000;
const REFRESH_DEBOUNCE_MS = 250;
const TOAST_TIMEOUT_MS = 7_000;

type DeliveryAlertStatus = "ready" | "out_for_delivery" | "completed";
type DeliveryAlertSnapshot = {
  orderId: string;
  assignedAt: string;
  shortCode: string;
  status: DeliveryAlertStatus;
};
type DeliveryAlertResponse = {
  deliveries?: DeliveryAlertSnapshot[];
};

/**
 * Global real-time alert layer for the rider dashboard. Mounted in the rider
 * layout so it stays alive across page navigations - riders get the popup +
 * loud alarm anywhere in the dashboard, not just on the Deliveries page.
 *
 * Subscribes to Supabase Realtime for new assignments / status changes, plays a
 * loud alert + vibration on a genuinely new delivery, refreshes the active route
 * so fresh data renders, and degrades to polling when the socket drops or the
 * tab returns to the foreground. Page-level controls read this via useRiderAlerts.
 */
export function RiderAlertsProvider({
  riderId,
  children,
}: {
  riderId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [conn, setConn] = useState<ConnState>("connecting");
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  // ---- refs that must survive re-renders without re-subscribing ----
  const announced = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  const mountedAt = useRef<number | null>(null);
  const knownOrders = useRef<Set<string>>(new Set());
  const lastStatusByOrder = useRef<Map<string, DeliveryAlertStatus>>(new Map());
  const snapshotInFlight = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  // Restore the rider's saved sound preference. One-time sync from an external
  // store (localStorage) - starting from the SSR default avoids a hydration
  // mismatch, so the follow-up setState here is intentional.
  useEffect(() => {
    const saved = window.localStorage.getItem(SOUND_PREF_KEY);
    if (saved === "off") {
      soundOnRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoundOn(false);
    }
  }, []);

  // ---- audio: synthesize a loud three-tone ding (no asset, always loud) ----
  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtxRef.current = new Ctor();
    return audioCtxRef.current;
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    const ctx = ensureCtx();
    if (!ctx) return false;
    await ctx.resume();
    const running = ctx.state === "running";
    setAudioReady(running);
    return running;
  }, [ensureCtx]);

  const playDing = useCallback(() => {
    if (!soundOnRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    void ctx.resume();
    const now = ctx.currentTime;
    // Rising 3-beep alarm - square waves at high gain cut through ambient noise.
    const steps: Array<{ at: number; freq: number }> = [
      { at: 0, freq: 880 }, // A5
      { at: 0.18, freq: 1108.73 }, // C#6
      { at: 0.36, freq: 1318.51 }, // E6
    ];
    for (const { at, freq } of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.55, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.17);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.2);
    }
  }, [ensureCtx]);

  // Unlock the audio context and immediately chime, so tapping "enable"/unmute
  // gives audible proof the alert works on this device - no need to wait for a
  // real order to land.
  const enableSound = useCallback(() => {
    void unlockAudio().then((running) => {
      if (running) playDing();
    });
  }, [unlockAudio, playDing]);

  const setSound = useCallback(
    (on: boolean) => {
      soundOnRef.current = on;
      setSoundOn(on);
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
      } catch {
        /* private mode - preference just won't persist */
      }
      if (on) enableSound();
    },
    [enableSound]
  );

  // Auto-unlock the audio context on the rider's first interaction anywhere in
  // the dashboard, so the alarm can fire without an explicit "enable sound" tap.
  useEffect(() => {
    if (audioReady) return;
    const handler = () => unlockAudio();
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, opts);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [audioReady, unlockAudio]);

  // ---- coalesced refresh of the active route ----
  const scheduleRefresh = useCallback(() => {
    setPendingRefresh(true);
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      setPendingRefresh(false);
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  const refreshNow = useCallback(() => router.refresh(), [router]);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current !== undefined) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = undefined;
    }
  }, []);

  const showToast = useCallback((text: string) => {
    setToast({ key: Date.now(), text });
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      TOAST_TIMEOUT_MS
    );
  }, []);

  // A genuinely new delivery: alert once, then refresh to render it.
  const announce = useCallback(
    (orderId: string | undefined, text = "New delivery assigned") => {
      if (orderId && !announced.current.has(orderId)) {
        announced.current.add(orderId);
        playDing();
        navigator.vibrate?.([220, 90, 220, 90, 360]);
        showToast(text);
      }
      scheduleRefresh();
    },
    [playDing, showToast, scheduleRefresh]
  );

  const reconcileSnapshot = useCallback(
    (deliveries: DeliveryAlertSnapshot[], mode: "seed" | "notify") => {
      let changed = false;

      for (const delivery of deliveries) {
        const wasKnown = knownOrders.current.has(delivery.orderId);
        const previousStatus = lastStatusByOrder.current.get(delivery.orderId);
        knownOrders.current.add(delivery.orderId);
        lastStatusByOrder.current.set(delivery.orderId, delivery.status);

        if (!wasKnown || previousStatus !== delivery.status) changed = true;

        const assignedAt = Date.parse(delivery.assignedAt);
        const mountedAtMs = mountedAt.current ?? 0;
        const assignedAfterMount =
          Number.isFinite(assignedAt) && assignedAt >= mountedAtMs - 1000;
        const shouldAlertNew =
          !wasKnown &&
          delivery.status !== "completed" &&
          (mode === "notify" || assignedAfterMount);
        const becameReady =
          wasKnown &&
          previousStatus !== undefined &&
          previousStatus !== "ready" &&
          delivery.status === "ready";

        if (shouldAlertNew) {
          announce(
            delivery.orderId,
            `New delivery assigned: ${delivery.shortCode}`
          );
        } else if (becameReady) {
          announce(delivery.orderId, `Delivery ready: ${delivery.shortCode}`);
        }
      }

      if (changed && mode === "notify") scheduleRefresh();
    },
    [announce, scheduleRefresh]
  );

  const fetchAlertSnapshot = useCallback(
    async (mode: "seed" | "notify") => {
      if (snapshotInFlight.current) return;
      snapshotInFlight.current = true;
      try {
        const response = await fetch("/rider/alerts", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as DeliveryAlertResponse;
        reconcileSnapshot(payload.deliveries ?? [], mode);
      } catch {
        // Realtime and route refresh fallback still cover transient failures.
      } finally {
        snapshotInFlight.current = false;
      }
    },
    [reconcileSnapshot]
  );

  // ---- realtime subscription (persists across rider-dashboard navigation) ----
  useEffect(() => {
    const supabase: SupabaseClient = createAdminClient();
    let cancelled = false;

    type Row = Record<string, unknown>;
    const orderIdOf = (
      p: RealtimePostgresChangesPayload<Row>
    ): string | undefined => {
      const next = (p.new ?? {}) as Row;
      const prev = (p.old ?? {}) as Row;
      return (next.order_id ?? prev.order_id ?? next.id ?? prev.id) as
        | string
        | undefined;
    };

    const channel = supabase
      .channel(`rider-deliveries-${riderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rider_assignments",
          filter: `rider_profile_id=eq.${riderId}`,
        },
        (payload) =>
          announce(
            orderIdOf(payload as RealtimePostgresChangesPayload<Row>),
            "New delivery assigned"
          )
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rider_assignments",
          filter: `rider_profile_id=eq.${riderId}`,
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rider_assignments",
          filter: `rider_profile_id=eq.${riderId}`,
        },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        // RLS already limits this to the rider's assigned orders; we can't add a
        // join filter, so let the policy do the scoping.
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const p = payload as RealtimePostgresChangesPayload<Row>;
          const next = (p.new ?? {}) as Row;
          // An order becoming "ready" is when an already-assigned delivery turns
          // actionable on the dashboard - treat it as a fresh arrival.
          if (next.status === "ready")
            announce(next.id as string | undefined, "Delivery ready for pickup");
          else scheduleRefresh();
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setConn("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setConn("reconnecting");
        else if (status === "CLOSED") setConn("reconnecting");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [riderId, announce, scheduleRefresh]);

  // ---- server-backed alert catch-up (covers missed websocket events) ----
  useEffect(() => {
    mountedAt.current ??= Date.now();
    const seedTimer = window.setTimeout(
      () => void fetchAlertSnapshot("seed"),
      0
    );
    const interval = window.setInterval(
      () => void fetchAlertSnapshot("notify"),
      ALERT_SNAPSHOT_MS
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchAlertSnapshot("notify");
      }
    };
    const onOnline = () => void fetchAlertSnapshot("notify");

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(seedTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [fetchAlertSnapshot]);

  // ---- fallback: poll + catch up on focus/online (covers dropped sockets) ----
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
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    const onOnline = () => router.refresh();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  // Clean up timers on unmount.
  useEffect(
    () => () => {
      if (refreshTimer.current !== undefined)
        window.clearTimeout(refreshTimer.current);
      if (toastTimer.current !== undefined)
        window.clearTimeout(toastTimer.current);
    },
    []
  );

  return (
    <RiderAlertsContext.Provider
      value={{
        conn,
        soundOn,
        audioReady,
        pendingRefresh,
        setSound,
        enableSound,
        refreshNow,
      }}
    >
      {children}

      {toast && (
        <div
          key={toast.key}
          className="zb-toast-in fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4"
          role="status"
          aria-live="assertive"
        >
          <button
            type="button"
            onClick={() => {
              dismissToast();
              router.push("/rider");
            }}
            className="flex items-center gap-3 rounded-xl border border-zb-bone/45 bg-zb-primary-dark/95 px-4 py-3 text-left shadow-[0_20px_55px_rgba(0,0,0,0.55)] backdrop-blur transition hover:border-zb-bone/70"
          >
            <span className="zb-live-dot flex size-9 shrink-0 items-center justify-center rounded-full bg-zb-bone/15 text-zb-bone">
              <PackagePlus className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zb-cream">{toast.text}</p>
              <p className="text-xs text-zb-cream/55">Tap to open your deliveries.</p>
            </div>
          </button>
        </div>
      )}
    </RiderAlertsContext.Provider>
  );
}
