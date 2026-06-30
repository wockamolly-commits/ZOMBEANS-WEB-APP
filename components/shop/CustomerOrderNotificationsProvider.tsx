"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Truck, XCircle } from "lucide-react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import {
  CUSTOMER_ORDER_EVENT,
  CUSTOMER_ORDER_STORAGE_KEY,
  CUSTOMER_ORDER_TRACKING_EVENT,
  customerOrderTopic,
  isCustomerOrderAlert,
  normalizeOrderCode,
  type CustomerOrderAlertStatus,
  type CustomerServiceMode,
  type CustomerOrderStatus,
  type CustomerOrderStatusPayload,
} from "@/lib/customer-order-realtime";

type StoredCustomerOrder = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode?: CustomerServiceMode | null;
  notifiedStatus?: CustomerOrderStatus;
  updatedAt: string;
};

type SnapshotOrder = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode: CustomerServiceMode | null;
  rejectedReason: string | null;
};

type SnapshotResponse = {
  orders?: SnapshotOrder[];
};

type ToastState = {
  key: number;
  shortCode: string;
  status: CustomerOrderAlertStatus;
  serviceMode: CustomerServiceMode | null;
  rejectedReason: string | null;
};

const SNAPSHOT_MS = 5_000;
const REFRESH_DEBOUNCE_MS = 250;
const TOAST_TIMEOUT_MS = 7_000;
const MAX_STORED_ORDERS = 12;

const DISABLED_PREFIXES = [
  "/workspace",
  "/rider",
  "/login",
  "/auth",
  "/api",
];

function readStoredOrders(): StoredCustomerOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOMER_ORDER_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<StoredCustomerOrder>;
      if (
        typeof candidate.shortCode !== "string" ||
        typeof candidate.status !== "string"
      ) {
        return [];
      }
      return [
        {
          shortCode: normalizeOrderCode(candidate.shortCode),
          status: candidate.status as CustomerOrderStatus,
          serviceMode:
            typeof candidate.serviceMode === "string"
              ? (candidate.serviceMode as CustomerServiceMode)
              : null,
          notifiedStatus: candidate.notifiedStatus,
          updatedAt:
            typeof candidate.updatedAt === "string"
              ? candidate.updatedAt
              : new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeStoredOrders(orders: StoredCustomerOrder[]) {
  try {
    window.localStorage.setItem(
      CUSTOMER_ORDER_STORAGE_KEY,
      JSON.stringify(orders.slice(0, MAX_STORED_ORDERS))
    );
  } catch {
    /* Tracking remains in memory for this page view. */
  }
}

function upsertStoredOrder(
  next: Pick<StoredCustomerOrder, "shortCode" | "status" | "serviceMode"> & {
    notifiedStatus?: CustomerOrderStatus;
  }
) {
  const shortCode = normalizeOrderCode(next.shortCode);
  const orders = readStoredOrders();
  const previous = orders.find((order) => order.shortCode === shortCode);
  const rest = orders.filter((order) => order.shortCode !== shortCode);
  rest.unshift({
    shortCode,
    status: next.status,
    serviceMode: next.serviceMode ?? previous?.serviceMode ?? null,
    notifiedStatus: next.notifiedStatus ?? previous?.notifiedStatus,
    updatedAt: new Date().toISOString(),
  });
  writeStoredOrders(rest);
}

function toastCopy(status: CustomerOrderAlertStatus, serviceMode: CustomerServiceMode | null) {
  if (status === "ready") {
    if (serviceMode === "delivery") {
      return {
        title: "Order ready for delivery",
        detail: "Your delivery order is packed and waiting for a rider.",
      };
    }
    return {
      title:
        serviceMode === "dine_in"
          ? "Order ready for serving"
          : "Order ready for pickup",
      detail:
        serviceMode === "dine_in"
          ? "Your dine-in order is ready to be claimed or served."
          : "Your pickup order is ready at the counter.",
    };
  }
  if (status === "out_for_delivery") {
    return {
      title: "Order out for delivery",
      detail: "Your rider is on the way with your order.",
    };
  }
  if (status === "completed") {
    if (serviceMode === "delivery") {
      return {
        title: "Order delivered",
        detail: "Your delivery has arrived. Enjoy!",
      };
    }
    return {
      title: "Order completed",
      detail: "Thanks for ordering from Zombeans.",
    };
  }
  return {
    title: "Order rejected",
    detail: "Tap to view the reason and next steps.",
  };
}

export function CustomerOrderNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const disabled = DISABLED_PREFIXES.some((prefix) =>
    pathname?.startsWith(prefix)
  );

  const [trackedOrders, setTrackedOrders] = useState<StoredCustomerOrder[]>([]);
  const [hasCustomerSession, setHasCustomerSession] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const trackedOrdersRef = useRef<StoredCustomerOrder[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioReadyRef = useRef(false);
  const snapshotInFlight = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const announced = useRef<Set<string>>(new Set());

  const trackedCodes = useMemo(
    () => trackedOrders.map((order) => order.shortCode),
    [trackedOrders]
  );

  useEffect(() => {
    trackedOrdersRef.current = trackedOrders;
  }, [trackedOrders]);

  const syncTrackedOrders = useCallback(() => {
    if (disabled) return;
    setTrackedOrders(readStoredOrders());
  }, [disabled]);

  useEffect(() => {
    const syncTimer = window.setTimeout(syncTrackedOrders, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CUSTOMER_ORDER_STORAGE_KEY) syncTrackedOrders();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CUSTOMER_ORDER_TRACKING_EVENT, syncTrackedOrders);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        CUSTOMER_ORDER_TRACKING_EVENT,
        syncTrackedOrders
      );
    };
  }, [syncTrackedOrders]);

  useEffect(() => {
    if (disabled) return;

    let active = true;
    const supabase = createBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasCustomerSession(Boolean(data.session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasCustomerSession(Boolean(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [disabled]);

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

  const unlockAudio = useCallback(async () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    await ctx.resume();
    audioReadyRef.current = ctx.state === "running";
  }, [ensureCtx]);

  useEffect(() => {
    if (disabled) return;
    const handler = () => void unlockAudio();
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, opts);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [disabled, unlockAudio]);

  const playAlertSound = useCallback(async (status: CustomerOrderAlertStatus) => {
    const ctx = ensureCtx();
    if (!ctx) return;

    try {
      await ctx.resume();
    } catch {
      return;
    }
    if (ctx.state !== "running") return;

    const now = ctx.currentTime;
    const steps: Array<{
      at: number;
      freq: number;
      gain: number;
      duration: number;
      type: OscillatorType;
    }> =
      status === "rejected"
        ? [
            { at: 0, freq: 392, gain: 0.42, duration: 0.18, type: "triangle" },
            { at: 0.22, freq: 330, gain: 0.46, duration: 0.22, type: "triangle" },
            { at: 0.5, freq: 392, gain: 0.38, duration: 0.18, type: "triangle" },
          ]
        : status === "ready"
          ? [
              { at: 0, freq: 587.33, gain: 0.34, duration: 0.2, type: "sine" },
              { at: 0.16, freq: 783.99, gain: 0.38, duration: 0.22, type: "sine" },
              { at: 0.38, freq: 987.77, gain: 0.3, duration: 0.2, type: "sine" },
            ]
        : status === "out_for_delivery"
          ? [
              { at: 0, freq: 523.25, gain: 0.32, duration: 0.18, type: "sine" },
              { at: 0.18, freq: 659.25, gain: 0.36, duration: 0.18, type: "sine" },
              { at: 0.36, freq: 523.25, gain: 0.3, duration: 0.18, type: "sine" },
              { at: 0.54, freq: 659.25, gain: 0.34, duration: 0.2, type: "sine" },
            ]
        : [
            { at: 0, freq: 659.25, gain: 0.3, duration: 0.24, type: "sine" },
            { at: 0.14, freq: 880, gain: 0.34, duration: 0.24, type: "sine" },
            { at: 0.28, freq: 1174.66, gain: 0.28, duration: 0.24, type: "sine" },
          ];

    for (const { at, freq, gain: peak, duration, type } of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + duration + 0.02);
    }
  }, [ensureCtx]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      TOAST_TIMEOUT_MS
    );
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current !== undefined) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = undefined;
    }
  }, []);

  const reconcileOrder = useCallback(
    (
      next: CustomerOrderStatusPayload,
      mode: "seed" | "notify" | "live"
    ) => {
      const shortCode = normalizeOrderCode(next.shortCode);
      const previous = trackedOrdersRef.current.find(
        (order) => order.shortCode === shortCode
      );
      const previousStatus = previous?.status;
      const statusChanged = previousStatus !== next.status;
      const alertKey = `${shortCode}:${next.status}`;
      const alreadyNotified =
        announced.current.has(alertKey) ||
        previous?.notifiedStatus === next.status;

      upsertStoredOrder({
        shortCode,
        status: next.status,
        serviceMode: next.serviceMode,
        notifiedStatus:
          previous?.notifiedStatus ??
          (mode === "seed" && isCustomerOrderAlert(next.status, next.serviceMode)
            ? next.status
            : undefined),
      });
      syncTrackedOrders();

      if (statusChanged || mode === "live") scheduleRefresh();

      if (
        mode !== "seed" &&
        statusChanged &&
        isCustomerOrderAlert(next.status, next.serviceMode) &&
        !alreadyNotified
      ) {
        announced.current.add(alertKey);
        upsertStoredOrder({
          shortCode,
          status: next.status,
          serviceMode: next.serviceMode,
          notifiedStatus: next.status,
        });
        syncTrackedOrders();
        void playAlertSound(next.status);
        navigator.vibrate?.(
          next.status === "completed"
            ? [120, 60, 160]
            : next.status === "ready"
              ? [160, 70, 160]
              : next.status === "out_for_delivery"
                ? [90, 50, 90, 50, 140]
                : [220]
        );
        showToast({
          key: Date.now(),
          shortCode,
          status: next.status,
          serviceMode: next.serviceMode,
          rejectedReason: next.rejectedReason,
        });
      }
    },
    [playAlertSound, scheduleRefresh, showToast, syncTrackedOrders]
  );

  const fetchSnapshot = useCallback(
    async (mode: "seed" | "notify") => {
      if (disabled || snapshotInFlight.current) return;
      if (!hasCustomerSession && trackedCodes.length === 0) return;

      snapshotInFlight.current = true;
      try {
        const response = await fetch("/customer/order-alerts", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codes: trackedCodes }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as SnapshotResponse;
        for (const order of payload.orders ?? []) {
          reconcileOrder(
            {
              shortCode: order.shortCode,
              status: order.status,
              serviceMode: order.serviceMode,
              rejectedReason: order.rejectedReason,
              changedAt: new Date().toISOString(),
            },
            mode
          );
        }
      } catch {
        // Realtime subscriptions and the next snapshot will catch up.
      } finally {
        snapshotInFlight.current = false;
      }
    },
    [disabled, hasCustomerSession, reconcileOrder, trackedCodes]
  );

  useEffect(() => {
    if (disabled) return;
    const seedTimer = window.setTimeout(
      () => void fetchSnapshot("seed"),
      0
    );
    const interval = window.setInterval(
      () => void fetchSnapshot("notify"),
      SNAPSHOT_MS
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchSnapshot("notify");
      }
    };
    const onOnline = () => void fetchSnapshot("notify");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(seedTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [disabled, fetchSnapshot]);

  useEffect(() => {
    if (disabled || trackedCodes.length === 0) return;
    const supabase = createBrowserClient();
    const channels = trackedCodes.map((code) =>
      supabase
        .channel(customerOrderTopic(code))
        .on<CustomerOrderStatusPayload>(
          "broadcast",
          { event: CUSTOMER_ORDER_EVENT },
          ({ payload }) => reconcileOrder(payload, "live")
        )
        .subscribe()
    );

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [disabled, reconcileOrder, trackedCodes]);

  useEffect(() => {
    if (disabled || !hasCustomerSession) return;
    const supabase: SupabaseClient = createBrowserClient();

    type Row = Record<string, unknown>;
    const channel = supabase
      .channel("customer-owned-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const next = (
            payload as RealtimePostgresChangesPayload<Row>
          ).new as Row;
          if (
            typeof next.short_code !== "string" ||
            typeof next.status !== "string"
          ) {
            scheduleRefresh();
            void fetchSnapshot("notify");
            return;
          }
          reconcileOrder(
            {
              shortCode: next.short_code,
              status: next.status as CustomerOrderStatus,
              serviceMode:
                typeof next.service_mode === "string"
                  ? (next.service_mode as CustomerServiceMode)
                  : null,
              rejectedReason:
                typeof next.rejected_reason === "string"
                  ? next.rejected_reason
                  : null,
              changedAt: new Date().toISOString(),
            },
            "live"
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    disabled,
    fetchSnapshot,
    hasCustomerSession,
    reconcileOrder,
    scheduleRefresh,
  ]);

  useEffect(
    () => () => {
      if (refreshTimer.current !== undefined)
        window.clearTimeout(refreshTimer.current);
      if (toastTimer.current !== undefined)
        window.clearTimeout(toastTimer.current);
    },
    []
  );

  if (disabled) return <>{children}</>;

  const copy = toast ? toastCopy(toast.status, toast.serviceMode) : null;
  const Icon =
    toast?.status === "rejected"
      ? XCircle
      : toast?.status === "out_for_delivery"
        ? Truck
        : CheckCircle2;

  return (
    <>
      {children}

      {toast && copy && (
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
              router.push(`/order/${toast.shortCode}`);
            }}
            className="flex w-full max-w-md items-center gap-3 rounded-xl border border-zb-bone/45 bg-zb-primary-dark/95 px-4 py-3 text-left shadow-[0_22px_60px_rgba(0,0,0,0.55)] backdrop-blur transition hover:border-zb-bone/75"
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                toast.status === "rejected"
                  ? "bg-zb-danger/20 text-red-200"
                  : "bg-zb-bone/15 text-zb-bone"
              }`}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zb-cream">
                {copy.title} {toast.shortCode}
              </p>
              <p className="truncate text-xs text-zb-cream/60">
                {toast.rejectedReason ?? copy.detail}
              </p>
            </div>
            <BellRing className="size-4 shrink-0 text-zb-cream/45" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
