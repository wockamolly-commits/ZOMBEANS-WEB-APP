"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  RefreshCw,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/browser";
import { formatPeso } from "@/lib/peso";
import type {
  AdminOrderAlert,
  AdminOrderAlertSnapshot,
} from "@/lib/admin-order-alert-types";

type ConnState = "connecting" | "live" | "reconnecting";

type AdminRealtimeValue = {
  conn: ConnState;
  soundOn: boolean;
  audioReady: boolean;
  pendingRefresh: boolean;
  pendingCount: number;
  setSound: (on: boolean) => void;
  enableSound: () => void;
  refreshNow: () => void;
};

const AdminRealtimeContext = createContext<AdminRealtimeValue | null>(null);

const SOUND_PREF_KEY = "zb-admin-order-sound";
const FALLBACK_POLL_MS = 20_000;
const ALERT_SNAPSHOT_MS = 5_000;
const REFRESH_DEBOUNCE_MS = 300;
const TOAST_TIMEOUT_MS = 8_000;

const SERVICE_LABEL: Record<AdminOrderAlert["serviceMode"], string> = {
  dine_in: "Dine-in",
  take_out: "Take Out",
  pickup: "Pickup",
  delivery: "Delivery",
};

function useAdminRealtime(): AdminRealtimeValue {
  const ctx = useContext(AdminRealtimeContext);
  if (!ctx) {
    throw new Error("useAdminRealtime must be used within AdminRealtimeProvider");
  }
  return ctx;
}

function normalizeOrder(row: Record<string, unknown>): AdminOrderAlert | null {
  const id = row.id;
  const shortCode = row.short_code;
  const placedAt = row.placed_at;
  const serviceMode = row.service_mode;
  const customerName = row.customer_name;
  const totalCents = row.total_cents;

  if (
    typeof id !== "string" ||
    typeof shortCode !== "string" ||
    typeof placedAt !== "string" ||
    typeof serviceMode !== "string" ||
    !["dine_in", "take_out", "pickup", "delivery"].includes(serviceMode) ||
    typeof customerName !== "string" ||
    typeof totalCents !== "number"
  ) {
    return null;
  }

  return {
    id,
    shortCode,
    placedAt,
    serviceMode: serviceMode as AdminOrderAlert["serviceMode"],
    customerName,
    totalCents,
    itemCount: 0,
  };
}

function orderLine(order: AdminOrderAlert): string {
  const items =
    order.itemCount > 0
      ? ` - ${order.itemCount} item${order.itemCount === 1 ? "" : "s"}`
      : "";
  return `${SERVICE_LABEL[order.serviceMode]} - ${formatPeso(order.totalCents)}${items}`;
}

/**
 * Global real-time layer for the admin workspace. It stays mounted for the
 * whole dashboard, so incoming orders alert cashiers from any workspace page.
 */
export function AdminRealtimeProvider({
  children,
  canViewOrders,
  initialSnapshot,
}: {
  children: React.ReactNode;
  canViewOrders: boolean;
  initialSnapshot: AdminOrderAlertSnapshot;
}) {
  const router = useRouter();

  const [conn, setConn] = useState<ConnState>(
    canViewOrders ? "connecting" : "live"
  );
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [pendingCount, setPendingCount] = useState(
    initialSnapshot.pendingCount
  );
  const [toast, setToast] = useState<{
    key: number;
    order: AdminOrderAlert;
  } | null>(null);

  const knownOrders = useRef<Set<string>>(
    new Set(initialSnapshot.orders.map((order) => order.id))
  );
  const announced = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  const mountedAt = useRef<number | null>(null);
  const snapshotInFlight = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    for (const order of initialSnapshot.orders) {
      knownOrders.current.add(order.id);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    const saved = window.localStorage.getItem(SOUND_PREF_KEY);
    if (saved === "off") {
      soundOnRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoundOn(false);
    }
  }, []);

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

  const playAlert = useCallback(() => {
    if (!soundOnRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    void ctx.resume();

    const now = ctx.currentTime;
    const steps: Array<{ at: number; freq: number; gain: number }> = [
      { at: 0, freq: 784, gain: 0.65 },
      { at: 0.16, freq: 988, gain: 0.72 },
      { at: 0.32, freq: 1318, gain: 0.78 },
      { at: 0.62, freq: 988, gain: 0.7 },
    ];

    for (const { at, freq, gain: peak } of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.17);
    }
  }, [ensureCtx]);

  const enableSound = useCallback(() => {
    void unlockAudio().then((running) => {
      if (running) playAlert();
    });
  }, [playAlert, unlockAudio]);

  const setSound = useCallback(
    (on: boolean) => {
      soundOnRef.current = on;
      setSoundOn(on);
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
      } catch {
        /* Preference remains session-only in private mode. */
      }
      if (on) enableSound();
    },
    [enableSound]
  );

  useEffect(() => {
    if (audioReady || !canViewOrders) return;
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
  }, [audioReady, canViewOrders, unlockAudio]);

  const scheduleRefresh = useCallback(() => {
    setPendingRefresh(true);
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      setPendingRefresh(false);
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  const refreshNow = useCallback(() => {
    router.refresh();
  }, [router]);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current !== undefined) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = undefined;
    }
  }, []);

  const showToast = useCallback((order: AdminOrderAlert) => {
    setToast({ key: Date.now(), order });
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      TOAST_TIMEOUT_MS
    );
  }, []);

  const announce = useCallback(
    (order: AdminOrderAlert) => {
      if (announced.current.has(order.id)) return;
      announced.current.add(order.id);
      knownOrders.current.add(order.id);
      setPendingCount((count) => Math.max(count + 1, 1));
      playAlert();
      navigator.vibrate?.([260, 90, 260, 90, 420]);
      showToast(order);
      scheduleRefresh();
    },
    [playAlert, scheduleRefresh, showToast]
  );

  const reconcileSnapshot = useCallback(
    (snapshot: AdminOrderAlertSnapshot, mode: "seed" | "notify") => {
      setPendingCount(snapshot.pendingCount);
      for (const order of snapshot.orders) {
        const wasKnown = knownOrders.current.has(order.id);
        knownOrders.current.add(order.id);
        const placedAt = Date.parse(order.placedAt);
        const mountedAtMs = mountedAt.current ?? 0;
        const placedAfterRender =
          Number.isFinite(placedAt) && placedAt >= mountedAtMs - 30_000;
        if (!wasKnown && (mode === "notify" || placedAfterRender)) {
          announce(order);
        }
      }
    },
    [announce]
  );

  const fetchAlertSnapshot = useCallback(
    async (mode: "seed" | "notify") => {
      if (!canViewOrders || snapshotInFlight.current) return;
      snapshotInFlight.current = true;
      try {
        const response = await fetch("/workspace/alerts", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as AdminOrderAlertSnapshot;
        reconcileSnapshot(payload, mode);
      } catch {
        // The websocket and route refresh paths still cover transient failures.
      } finally {
        snapshotInFlight.current = false;
      }
    },
    [canViewOrders, reconcileSnapshot]
  );

  useEffect(() => {
    if (!canViewOrders) return;
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
  }, [canViewOrders, fetchAlertSnapshot]);

  useEffect(() => {
    if (!canViewOrders) return;
    const supabase: SupabaseClient = createAdminClient();
    let cancelled = false;

    type Row = Record<string, unknown>;
    const channel = supabase
      .channel("admin-workspace-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const next = (
            payload as RealtimePostgresChangesPayload<Row>
          ).new as Row;
          if (next.status === "pending") {
            const order = normalizeOrder(next);
            if (order) announce(order);
            else scheduleRefresh();
          } else {
            scheduleRefresh();
          }
          void fetchAlertSnapshot("notify");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          scheduleRefresh();
          void fetchAlertSnapshot("notify");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_assignments" },
        () => scheduleRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => scheduleRefresh()
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
  }, [announce, canViewOrders, fetchAlertSnapshot, scheduleRefresh]);

  useEffect(() => {
    if (!canViewOrders) return;
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
  }, [canViewOrders, router]);

  useEffect(
    () => () => {
      if (refreshTimer.current !== undefined)
        window.clearTimeout(refreshTimer.current);
      if (toastTimer.current !== undefined)
        window.clearTimeout(toastTimer.current);
    },
    []
  );

  const value = useMemo(
    () => ({
      conn,
      soundOn,
      audioReady,
      pendingRefresh,
      pendingCount,
      setSound,
      enableSound,
      refreshNow,
    }),
    [
      audioReady,
      conn,
      enableSound,
      pendingCount,
      pendingRefresh,
      refreshNow,
      setSound,
      soundOn,
    ]
  );

  return (
    <AdminRealtimeContext.Provider value={value}>
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
              router.push("/workspace/orders");
            }}
            className="flex w-full max-w-md items-center gap-3 rounded-xl border border-zb-bone/55 bg-zb-primary-dark/95 px-4 py-3 text-left shadow-[0_22px_60px_rgba(0,0,0,0.58)] backdrop-blur transition hover:border-zb-bone/80"
          >
            <span className="zb-live-dot flex size-10 shrink-0 items-center justify-center rounded-full bg-zb-bone/15 text-zb-bone">
              <BellRing className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zb-cream">
                New order {toast.order.shortCode}
              </p>
              <p className="truncate text-xs text-zb-cream/60">
                {toast.order.customerName} - {orderLine(toast.order)}
              </p>
            </div>
          </button>
        </div>
      )}
    </AdminRealtimeContext.Provider>
  );
}

export function AdminOrderNavBadge() {
  const { pendingCount } = useAdminRealtime();
  if (pendingCount <= 0) return null;

  return (
    <span
      className="ml-0.5 min-w-5 rounded-full bg-zb-bone px-1.5 py-0.5 text-center font-mono-tabular text-[10px] font-bold leading-none text-zb-primary-dark"
      aria-label={`${pendingCount} pending orders`}
    >
      {pendingCount > 99 ? "99+" : pendingCount}
    </span>
  );
}

export function AdminRealtimeControls() {
  const {
    conn,
    soundOn,
    audioReady,
    pendingRefresh,
    setSound,
    enableSound,
    refreshNow,
  } = useAdminRealtime();
  const needsSoundTap = soundOn && !audioReady;
  const buttonMotion =
    "transition-[transform,background-color,border-color,color] duration-150 hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-95";
  const iconMotion = "transition-transform duration-150 group-hover:scale-110";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`hidden h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold sm:inline-flex ${
          conn === "live"
            ? "border-zb-sage/30 bg-zb-primary text-zb-cream/75"
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
        onClick={needsSoundTap ? enableSound : () => setSound(!soundOn)}
        aria-pressed={soundOn}
        aria-label={
          needsSoundTap
            ? "Enable order alert sound"
            : soundOn
              ? "Mute order alerts"
              : "Unmute order alerts"
        }
        title={
          needsSoundTap
            ? "Enable order alert sound"
            : soundOn
              ? "Mute order alerts"
              : "Unmute order alerts"
        }
        className={`relative inline-flex size-9 items-center justify-center rounded-md border transition ${
          needsSoundTap
            ? "border-zb-bone/55 bg-zb-bone/10 text-zb-bone"
            : "border-zb-sage/30 bg-zb-primary text-zb-cream/80 hover:text-zb-cream"
        } ${buttonMotion} group`}
      >
        {soundOn ? (
          <Volume2
            className={`size-4 text-zb-bone ${iconMotion} group-hover:-rotate-6`}
            aria-hidden
          />
        ) : (
          <VolumeX
            className={`size-4 ${iconMotion} group-hover:rotate-6`}
            aria-hidden
          />
        )}
      </button>

      <button
        type="button"
        disabled={pendingRefresh}
        onClick={refreshNow}
        className={`group inline-flex size-9 items-center justify-center rounded-md border border-zb-sage/30 bg-zb-primary text-zb-cream/80 hover:text-zb-cream disabled:cursor-wait disabled:opacity-65 ${buttonMotion}`}
        aria-label="Refresh orders"
        title="Refresh orders"
      >
        <RefreshCw
          className={`size-4 text-zb-bone transition-transform duration-300 ${
            pendingRefresh
              ? "animate-spin"
              : "group-hover:rotate-180 group-active:rotate-[260deg]"
          }`}
          aria-hidden
        />
      </button>
    </div>
  );
}
