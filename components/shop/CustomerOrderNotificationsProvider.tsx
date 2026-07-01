"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, CheckCircle2, DoorOpen, Truck, XCircle } from "lucide-react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import {
  CUSTOMER_ORDER_EVENT,
  CUSTOMER_READY_ACK_EVENT,
  CUSTOMER_ORDER_STORAGE_KEY,
  CUSTOMER_ORDER_TRACKING_EVENT,
  CUSTOMER_RIDER_OUTSIDE_ACK_EVENT,
  CUSTOMER_RIDER_OUTSIDE_EVENT,
  customerOrderTopic,
  isCustomerOrderAlert,
  normalizeOrderCode,
  type CustomerOrderAlertStatus,
  type CustomerServiceMode,
  type CustomerOrderStatus,
  type CustomerOrderStatusPayload,
  type CustomerRiderOutsidePayload,
} from "@/lib/customer-order-realtime";

// Toast/sound variants: the real order-status alerts plus the ephemeral
// "rider is outside" ping, which has no backing order status.
type CustomerToastStatus = CustomerOrderAlertStatus | "rider_outside";

type StoredCustomerOrder = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode?: CustomerServiceMode | null;
  notifiedStatus?: CustomerOrderStatus;
  readyAcknowledgedAt?: string | null;
  riderOutsideNotified?: boolean;
  riderOutsideRingAt?: string | null;
  riderOutsideAcknowledgedAt?: string | null;
  updatedAt: string;
};

type SnapshotOrder = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode: CustomerServiceMode | null;
  rejectedReason: string | null;
  readyAcknowledgedAt?: string | null;
  riderArrived?: boolean;
  riderRingAt?: string | null;
  riderAcknowledgedAt?: string | null;
};

type SnapshotResponse = {
  orders?: SnapshotOrder[];
};

type ToastState = {
  key: number;
  shortCode: string;
  status: CustomerToastStatus;
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

function isCounterReadyAlert(
  status: CustomerToastStatus,
  serviceMode: CustomerServiceMode | null | undefined
) {
  return (
    status === "ready" &&
    (serviceMode === "dine_in" || serviceMode === "pickup")
  );
}

function canRingRiderOutside(
  status: CustomerOrderStatus,
  serviceMode: CustomerServiceMode | null | undefined
) {
  return status === "out_for_delivery" && serviceMode === "delivery";
}

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
          readyAcknowledgedAt:
            typeof candidate.readyAcknowledgedAt === "string"
              ? candidate.readyAcknowledgedAt
              : null,
          riderOutsideNotified: candidate.riderOutsideNotified === true ? true : undefined,
          riderOutsideRingAt:
            typeof candidate.riderOutsideRingAt === "string"
              ? candidate.riderOutsideRingAt
              : null,
          riderOutsideAcknowledgedAt:
            typeof candidate.riderOutsideAcknowledgedAt === "string"
              ? candidate.riderOutsideAcknowledgedAt
              : null,
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
    readyAcknowledgedAt?: string | null;
    riderOutsideNotified?: boolean;
    riderOutsideRingAt?: string | null;
    riderOutsideAcknowledgedAt?: string | null;
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
    readyAcknowledgedAt:
      next.readyAcknowledgedAt ?? previous?.readyAcknowledgedAt ?? null,
    riderOutsideNotified:
      next.riderOutsideNotified ?? previous?.riderOutsideNotified,
    riderOutsideRingAt:
      next.riderOutsideRingAt ?? previous?.riderOutsideRingAt ?? null,
    riderOutsideAcknowledgedAt:
      next.riderOutsideAcknowledgedAt ??
      previous?.riderOutsideAcknowledgedAt ??
      null,
    updatedAt: new Date().toISOString(),
  });
  writeStoredOrders(rest);
}

function toastCopy(status: CustomerToastStatus, serviceMode: CustomerServiceMode | null) {
  if (status === "rider_outside") {
    return {
      title: "Your rider is outside",
      detail: "Your rider is already outside your house. Please meet them to receive your order.",
    };
  }
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
  const [audioReady, setAudioReady] = useState(false);
  const trackedOrdersRef = useRef<StoredCustomerOrder[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioReadyRef = useRef(false);
  const keepAliveTimer = useRef<number | undefined>(undefined);
  const readyLoopTimers = useRef<Map<string, number>>(new Map());
  const readyLoopSources = useRef<Map<string, Set<OscillatorNode>>>(new Map());
  const riderOutsideLoopTimers = useRef<Map<string, number>>(new Map());
  // Late-bound so enableSound (declared before playAlertSound) can trigger the
  // confirmation chime without a forward reference.
  const playAlertSoundRef = useRef<
    ((
      status: CustomerToastStatus,
      serviceMode?: CustomerServiceMode | null,
      readyLoopKey?: string
    ) => void | Promise<void>) | null
  >(null);
  const snapshotInFlight = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const announced = useRef<Set<string>>(new Set());
  // Tracks order codes whose "rider outside" ping has already alerted this
  // session, so the broadcast and the snapshot-poll fallback never double-fire.
  const riderOutsideAnnounced = useRef<Set<string>>(new Set());
  const acknowledgedReadyCodes = useRef<Set<string>>(new Set());
  const acknowledgedRiderOutsideCodes = useRef<Set<string>>(new Set());

  const trackedCodes = useMemo(
    () => trackedOrders.map((order) => order.shortCode),
    [trackedOrders]
  );

  useEffect(() => {
    trackedOrdersRef.current = trackedOrders;
  }, [trackedOrders]);

  const syncTrackedOrders = useCallback(() => {
    if (disabled) return;
    const orders = readStoredOrders();
    const acknowledgedRiderOutside = new Set(
      orders
        .filter((order) => order.riderOutsideAcknowledgedAt)
        .map((order) => normalizeOrderCode(order.shortCode))
    );
    setTrackedOrders(orders);
    if (acknowledgedRiderOutside.size > 0) {
      setToast((current) =>
        current?.status === "rider_outside" &&
        acknowledgedRiderOutside.has(normalizeOrderCode(current.shortCode))
          ? null
          : current
      );
    }
  }, [disabled]);

  const stopReadyLoop = useCallback((shortCode: string) => {
    const normalized = normalizeOrderCode(shortCode);
    const timer = readyLoopTimers.current.get(normalized);
    if (timer !== undefined) {
      window.clearInterval(timer);
      readyLoopTimers.current.delete(normalized);
    }

    const sources = readyLoopSources.current.get(normalized);
    if (!sources) return;
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
      source.disconnect();
    }
    sources.clear();
    readyLoopSources.current.delete(normalized);
  }, []);

  const stopAllReadyLoops = useCallback(() => {
    for (const timer of readyLoopTimers.current.values()) {
      window.clearInterval(timer);
    }
    readyLoopTimers.current.clear();
    for (const sources of readyLoopSources.current.values()) {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* Already stopped. */
        }
        source.disconnect();
      }
      sources.clear();
    }
    readyLoopSources.current.clear();
  }, []);

  const stopRiderOutsideLoop = useCallback((shortCode: string) => {
    const normalized = normalizeOrderCode(shortCode);
    const timer = riderOutsideLoopTimers.current.get(normalized);
    if (timer !== undefined) {
      window.clearInterval(timer);
      riderOutsideLoopTimers.current.delete(normalized);
    }
  }, []);

  const stopAllRiderOutsideLoops = useCallback(() => {
    for (const timer of riderOutsideLoopTimers.current.values()) {
      window.clearInterval(timer);
    }
    riderOutsideLoopTimers.current.clear();
  }, []);

  const markReadyAcknowledged = useCallback(
    (shortCode: string, acknowledgedAt?: string) => {
      const normalized = normalizeOrderCode(shortCode);
      acknowledgedReadyCodes.current.add(normalized);
      stopReadyLoop(normalized);

      const storedAcknowledgedAt =
        acknowledgedAt ??
        readStoredOrders().find((order) => order.shortCode === normalized)
          ?.readyAcknowledgedAt ??
        new Date().toISOString();

      setTrackedOrders((current) => {
        const next = current.map((order) =>
          order.shortCode === normalized
            ? { ...order, readyAcknowledgedAt: storedAcknowledgedAt }
            : order
        );
        trackedOrdersRef.current = next;
        return next;
      });
    },
    [stopReadyLoop]
  );

  const markRiderOutsideAcknowledged = useCallback(
    (shortCode: string, acknowledgedAt?: string) => {
      const normalized = normalizeOrderCode(shortCode);
      acknowledgedRiderOutsideCodes.current.add(normalized);
      stopRiderOutsideLoop(normalized);
      if (toastTimer.current !== undefined) {
        window.clearTimeout(toastTimer.current);
        toastTimer.current = undefined;
      }

      const previous = readStoredOrders().find(
        (order) => order.shortCode === normalized
      );
      const storedAcknowledgedAt =
        acknowledgedAt ??
        previous?.riderOutsideAcknowledgedAt ??
        new Date().toISOString();

      upsertStoredOrder({
        shortCode: normalized,
        status: previous?.status ?? "out_for_delivery",
        serviceMode: previous?.serviceMode ?? "delivery",
        notifiedStatus: previous?.notifiedStatus,
        readyAcknowledgedAt: previous?.readyAcknowledgedAt ?? null,
        riderOutsideNotified: true,
        riderOutsideRingAt: previous?.riderOutsideRingAt ?? null,
        riderOutsideAcknowledgedAt: storedAcknowledgedAt,
      });

      setTrackedOrders((current) => {
        const next = current.map((order) =>
          order.shortCode === normalized
            ? { ...order, riderOutsideAcknowledgedAt: storedAcknowledgedAt }
            : order
        );
        trackedOrdersRef.current = next;
        return next;
      });
      setToast((current) =>
        current?.status === "rider_outside" &&
        normalizeOrderCode(current.shortCode) === normalized
          ? null
          : current
      );
    },
    [stopRiderOutsideLoop]
  );

  useEffect(() => {
    for (const order of trackedOrders) {
      if (!order.readyAcknowledgedAt) continue;
      const shortCode = normalizeOrderCode(order.shortCode);
      acknowledgedReadyCodes.current.add(shortCode);
      stopReadyLoop(shortCode);
    }
    for (const order of trackedOrders) {
      if (!order.riderOutsideAcknowledgedAt) continue;
      const shortCode = normalizeOrderCode(order.shortCode);
      acknowledgedRiderOutsideCodes.current.add(shortCode);
      stopRiderOutsideLoop(shortCode);
    }
  }, [stopReadyLoop, stopRiderOutsideLoop, trackedOrders]);

  useEffect(() => {
    const syncTimer = window.setTimeout(syncTrackedOrders, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CUSTOMER_ORDER_STORAGE_KEY) return;
      const orders = readStoredOrders();
      for (const order of orders) {
        if (order.readyAcknowledgedAt) {
          acknowledgedReadyCodes.current.add(order.shortCode);
          stopReadyLoop(order.shortCode);
        }
        if (order.riderOutsideAcknowledgedAt) {
          acknowledgedRiderOutsideCodes.current.add(order.shortCode);
          stopRiderOutsideLoop(order.shortCode);
          setToast((current) =>
            current?.status === "rider_outside" &&
            normalizeOrderCode(current.shortCode) === order.shortCode
              ? null
              : current
          );
        }
      }
      setTrackedOrders(orders);
    };
    const onReadyAcknowledged = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          shortCode?: unknown;
          readyAcknowledgedAt?: unknown;
        }>
      ).detail;
      if (typeof detail?.shortCode === "string") {
        markReadyAcknowledged(
          detail.shortCode,
          typeof detail.readyAcknowledgedAt === "string"
            ? detail.readyAcknowledgedAt
            : undefined
        );
      } else {
        stopAllReadyLoops();
      }
      syncTrackedOrders();
    };
    const onRiderOutsideAcknowledged = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          shortCode?: unknown;
          riderAcknowledgedAt?: unknown;
        }>
      ).detail;
      if (typeof detail?.shortCode === "string") {
        markRiderOutsideAcknowledged(
          detail.shortCode,
          typeof detail.riderAcknowledgedAt === "string"
            ? detail.riderAcknowledgedAt
            : undefined
        );
      } else {
        stopAllRiderOutsideLoops();
      }
      syncTrackedOrders();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CUSTOMER_ORDER_TRACKING_EVENT, syncTrackedOrders);
    window.addEventListener(CUSTOMER_READY_ACK_EVENT, onReadyAcknowledged);
    window.addEventListener(
      CUSTOMER_RIDER_OUTSIDE_ACK_EVENT,
      onRiderOutsideAcknowledged
    );
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        CUSTOMER_ORDER_TRACKING_EVENT,
        syncTrackedOrders
      );
      window.removeEventListener(CUSTOMER_READY_ACK_EVENT, onReadyAcknowledged);
      window.removeEventListener(
        CUSTOMER_RIDER_OUTSIDE_ACK_EVENT,
        onRiderOutsideAcknowledged
      );
    };
  }, [
    markRiderOutsideAcknowledged,
    markReadyAcknowledged,
    stopAllRiderOutsideLoops,
    stopAllReadyLoops,
    stopRiderOutsideLoop,
    stopReadyLoop,
    syncTrackedOrders,
  ]);

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

  // A silent 1-sample "ping" keeps mobile AudioContexts from auto-suspending
  // while the customer idles on the tracking page waiting for the rider, so a
  // real alert minutes later still plays without a fresh tap.
  const silentPing = useCallback((ctx: AudioContext) => {
    try {
      const buffer = ctx.createBuffer(1, 1, 22_050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* best-effort keep-alive */
    }
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    const ctx = ensureCtx();
    if (!ctx) return false;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
    const running = ctx.state === "running";
    audioReadyRef.current = running;
    setAudioReady(running);
    if (running) silentPing(ctx);
    return running;
  }, [ensureCtx, silentPing]);

  // Explicit unlock with an audible confirmation chime, for the on-screen
  // "enable sound" affordance — proves to the customer that alerts will sound.
  const enableSound = useCallback(() => {
    void unlockAudio().then((running) => {
      if (running) void playAlertSoundRef.current?.("ready", "pickup");
    });
  }, [unlockAudio]);

  useEffect(() => {
    if (disabled) return;
    const handler = () => void unlockAudio();
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, opts);
    // Returning to the tab (unlock/foreground) is a chance to re-resume a
    // context the OS suspended while we were backgrounded.
    const onVisible = () => {
      if (document.visibilityState === "visible") void unlockAudio();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [disabled, unlockAudio]);

  // Keep the unlocked context warm while the page is open so idle suspension
  // doesn't silence a later alert.
  useEffect(() => {
    if (disabled) return;
    keepAliveTimer.current = window.setInterval(() => {
      const ctx = audioCtxRef.current;
      if (!ctx || !audioReadyRef.current) return;
      if (ctx.state !== "running") void ctx.resume();
      silentPing(ctx);
    }, 10_000);
    return () => {
      if (keepAliveTimer.current !== undefined) {
        window.clearInterval(keepAliveTimer.current);
        keepAliveTimer.current = undefined;
      }
    };
  }, [disabled, silentPing]);

  const playAlertSound = useCallback((
    status: CustomerToastStatus,
    serviceMode: CustomerServiceMode | null = null,
    readyLoopKey?: string
  ) => {
    const ctx = ensureCtx();
    if (!ctx) return;

    const counterReady = isCounterReadyAlert(status, serviceMode);
    const steps: Array<{
      at: number;
      freq: number;
      gain: number;
      duration: number;
      type: OscillatorType;
    }> =
      status === "rider_outside"
        ? [
            // Two ding-dong chimes — an unmistakable "someone's at the door".
            { at: 0, freq: 659.25, gain: 0.42, duration: 0.28, type: "sine" },
            { at: 0.3, freq: 523.25, gain: 0.44, duration: 0.42, type: "sine" },
            { at: 0.85, freq: 659.25, gain: 0.42, duration: 0.28, type: "sine" },
            { at: 1.15, freq: 523.25, gain: 0.44, duration: 0.42, type: "sine" },
          ]
        : status === "rejected"
        ? [
            { at: 0, freq: 392, gain: 0.42, duration: 0.18, type: "triangle" },
            { at: 0.22, freq: 330, gain: 0.46, duration: 0.22, type: "triangle" },
            { at: 0.5, freq: 392, gain: 0.38, duration: 0.18, type: "triangle" },
          ]
        : status === "ready"
          ? counterReady
            ? [
                { at: 0, freq: 1046.5, gain: 0.62, duration: 0.18, type: "square" },
                { at: 0.02, freq: 523.25, gain: 0.28, duration: 0.2, type: "triangle" },
                { at: 0.22, freq: 1318.51, gain: 0.66, duration: 0.18, type: "square" },
                { at: 0.24, freq: 659.25, gain: 0.3, duration: 0.2, type: "triangle" },
                { at: 0.46, freq: 1046.5, gain: 0.62, duration: 0.18, type: "square" },
                { at: 0.48, freq: 523.25, gain: 0.28, duration: 0.2, type: "triangle" },
                { at: 0.7, freq: 1567.98, gain: 0.68, duration: 0.2, type: "square" },
                { at: 0.72, freq: 783.99, gain: 0.3, duration: 0.22, type: "triangle" },
                { at: 1.06, freq: 1174.66, gain: 0.58, duration: 0.28, type: "square" },
                { at: 1.08, freq: 587.33, gain: 0.26, duration: 0.3, type: "triangle" },
                { at: 1.42, freq: 1567.98, gain: 0.72, duration: 0.32, type: "square" },
              ]
            : [
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

    const normalizedReadyLoopKey =
      readyLoopKey !== undefined ? normalizeOrderCode(readyLoopKey) : undefined;

    const schedule = () => {
      if (ctx.state !== "running") return;
      if (
        normalizedReadyLoopKey &&
        (!readyLoopTimers.current.has(normalizedReadyLoopKey) ||
          acknowledgedReadyCodes.current.has(normalizedReadyLoopKey))
      ) {
        return;
      }
      const now = ctx.currentTime;
      const trackedSources = normalizedReadyLoopKey
        ? readyLoopSources.current.get(normalizedReadyLoopKey) ??
          new Set<OscillatorNode>()
        : null;
      if (normalizedReadyLoopKey && trackedSources) {
        readyLoopSources.current.set(normalizedReadyLoopKey, trackedSources);
      }
      for (const { at, freq, gain: peak, duration, type } of steps) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + at);
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
        osc.connect(gain).connect(ctx.destination);
        if (trackedSources) {
          trackedSources.add(osc);
          osc.addEventListener(
            "ended",
            () => {
              trackedSources.delete(osc);
              try {
                osc.disconnect();
                gain.disconnect();
              } catch {
                /* Already disconnected. */
              }
            },
            { once: true }
          );
        }
        osc.start(now + at);
        osc.stop(now + at + duration + 0.02);
      }
    };

    if (ctx.state === "running") {
      schedule();
      return;
    }

    void ctx.resume().then(schedule).catch(() => {
      /* Browser still requires a fresh user gesture. */
    });
  }, [ensureCtx]);

  useEffect(() => {
    playAlertSoundRef.current = playAlertSound;
  }, [playAlertSound]);

  const startDineInReadyLoop = useCallback(
    (shortCode: string) => {
      const normalized = normalizeOrderCode(shortCode);
      if (readyLoopTimers.current.has(normalized)) return;
      if (acknowledgedReadyCodes.current.has(normalized)) return;

      const ring = () => {
        if (acknowledgedReadyCodes.current.has(normalized)) {
          stopReadyLoop(normalized);
          return;
        }
        playAlertSound("ready", "dine_in", normalized);
        navigator.vibrate?.([240, 80, 240, 80, 360]);
      };

      readyLoopTimers.current.set(normalized, window.setInterval(ring, 2_600));
      ring();
    },
    [playAlertSound, stopReadyLoop]
  );

  const startRiderOutsideLoop = useCallback(
    (shortCode: string) => {
      const normalized = normalizeOrderCode(shortCode);
      if (riderOutsideLoopTimers.current.has(normalized)) return;
      if (acknowledgedRiderOutsideCodes.current.has(normalized)) return;

      const ring = () => {
        if (acknowledgedRiderOutsideCodes.current.has(normalized)) {
          stopRiderOutsideLoop(normalized);
          return;
        }
        playAlertSound("rider_outside");
        navigator.vibrate?.([200, 90, 200, 90, 200]);
      };

      riderOutsideLoopTimers.current.set(
        normalized,
        window.setInterval(ring, 2_600)
      );
      ring();
    },
    [playAlertSound, stopRiderOutsideLoop]
  );

  useEffect(() => {
    if (disabled) {
      stopAllReadyLoops();
      stopAllRiderOutsideLoops();
      return;
    }

    const activeLoops = new Set<string>();
    const activeRiderOutsideLoops = new Set<string>();
    for (const order of trackedOrders) {
      const shortCode = normalizeOrderCode(order.shortCode);
      const shouldLoop =
        order.status === "ready" &&
        order.serviceMode === "dine_in" &&
        !order.readyAcknowledgedAt &&
        !acknowledgedReadyCodes.current.has(shortCode);

      if (shouldLoop) {
        activeLoops.add(shortCode);
        startDineInReadyLoop(shortCode);
      }

      const shouldLoopRiderOutside =
        canRingRiderOutside(order.status, order.serviceMode) &&
        order.riderOutsideNotified === true &&
        !order.riderOutsideAcknowledgedAt &&
        !acknowledgedRiderOutsideCodes.current.has(shortCode);

      if (shouldLoopRiderOutside) {
        activeRiderOutsideLoops.add(shortCode);
        startRiderOutsideLoop(shortCode);
      }
    }

    for (const shortCode of readyLoopTimers.current.keys()) {
      if (!activeLoops.has(shortCode)) stopReadyLoop(shortCode);
    }
    for (const shortCode of riderOutsideLoopTimers.current.keys()) {
      if (!activeRiderOutsideLoops.has(shortCode)) {
        stopRiderOutsideLoop(shortCode);
      }
    }
  }, [
    disabled,
    startDineInReadyLoop,
    startRiderOutsideLoop,
    stopAllRiderOutsideLoops,
    stopAllReadyLoops,
    stopRiderOutsideLoop,
    stopReadyLoop,
    trackedOrders,
  ]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current !== undefined) {
      window.clearTimeout(toastTimer.current);
    }
    if (next.status === "rider_outside") {
      toastTimer.current = undefined;
      return;
    }
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
      const previousStored = readStoredOrders().find(
        (order) => order.shortCode === shortCode
      );
      const previousStatus = previous?.status;
      const readyAcknowledgedAt =
        next.readyAcknowledgedAt ??
        previous?.readyAcknowledgedAt ??
        previousStored?.readyAcknowledgedAt ??
        (acknowledgedReadyCodes.current.has(shortCode)
          ? new Date().toISOString()
          : null);
      if (readyAcknowledgedAt) {
        acknowledgedReadyCodes.current.add(shortCode);
        stopReadyLoop(shortCode);
      }
      const statusChanged = previousStatus !== next.status;
      const alertKey = `${shortCode}:${next.status}`;
      const alreadyNotified =
        announced.current.has(alertKey) ||
        previous?.notifiedStatus === next.status;
      const alertStatus = isCustomerOrderAlert(next.status, next.serviceMode)
        ? next.status
        : null;
      const shouldNotify =
        mode !== "seed" &&
        alertStatus !== null &&
        !alreadyNotified &&
        // The tracking page can refresh and write the new status to storage
        // before this global provider receives the realtime/snapshot event.
        // In that race, statusChanged is false, but notifiedStatus is still
        // unset, so the customer should still get the toast and sound once.
        (statusChanged || previous?.notifiedStatus !== next.status);
      const notifyStatus = shouldNotify ? alertStatus : null;
      const shouldLoopDineInReady =
        next.status === "ready" &&
        next.serviceMode === "dine_in" &&
        !readyAcknowledgedAt;
      const terminal =
        next.status === "completed" ||
        next.status === "rejected" ||
        next.status === "cancelled";

      if (notifyStatus) {
        announced.current.add(alertKey);
        if (shouldLoopDineInReady) {
          startDineInReadyLoop(shortCode);
        } else {
          playAlertSound(notifyStatus, next.serviceMode);
          navigator.vibrate?.(
            next.status === "completed"
              ? [120, 60, 160]
              : next.status === "ready"
                ? isCounterReadyAlert(notifyStatus, next.serviceMode)
                  ? [240, 80, 240, 80, 360]
                  : [160, 70, 160]
                : next.status === "out_for_delivery"
                  ? [90, 50, 90, 50, 140]
                  : [220]
          );
        }
        showToast({
          key: Date.now(),
          shortCode,
          status: notifyStatus,
          serviceMode: next.serviceMode,
          rejectedReason: next.rejectedReason,
        });
      } else if (terminal) {
        stopRiderOutsideLoop(shortCode);
        setToast((current) =>
          current?.shortCode === shortCode &&
          current.status === "rider_outside"
            ? null
            : current
        );
      }

      upsertStoredOrder({
        shortCode,
        status: next.status,
        serviceMode: next.serviceMode,
        notifiedStatus:
          notifyStatus ??
          previous?.notifiedStatus ??
          (mode === "seed" && alertStatus
            ? next.status
            : undefined),
        readyAcknowledgedAt,
        riderOutsideNotified: previous?.riderOutsideNotified,
        riderOutsideRingAt: previous?.riderOutsideRingAt ?? null,
        riderOutsideAcknowledgedAt:
          previous?.riderOutsideAcknowledgedAt ?? null,
      });
      syncTrackedOrders();

      if (shouldLoopDineInReady) {
        startDineInReadyLoop(shortCode);
      } else {
        stopReadyLoop(shortCode);
      }

      if (statusChanged || mode === "live") scheduleRefresh();
    },
    [
      playAlertSound,
      scheduleRefresh,
      showToast,
      startDineInReadyLoop,
      stopRiderOutsideLoop,
      stopReadyLoop,
      syncTrackedOrders,
    ]
  );

  // Single entry point for the "rider outside" alert. Unlike normal status
  // toasts, this stays active and keeps ringing until the customer acknowledges
  // the rider's arrival.
  const fireRiderOutside = useCallback(
    (
      rawShortCode: string,
      options?: {
        force?: boolean;
        ringAt?: string | null;
        acknowledgedAt?: string | null;
      }
    ) => {
      const shortCode = normalizeOrderCode(rawShortCode);
      const acknowledgedAtFromMemory =
        acknowledgedRiderOutsideCodes.current.has(shortCode);
      const previous = readStoredOrders().find(
        (order) => order.shortCode === shortCode
      );
      if (
        previous &&
        !canRingRiderOutside(previous.status, previous.serviceMode)
      ) {
        return;
      }
      const hasFreshRing =
        typeof options?.ringAt === "string" &&
        options.ringAt.length > 0 &&
        previous?.riderOutsideRingAt !== options.ringAt;
      if (hasFreshRing) {
        acknowledgedRiderOutsideCodes.current.delete(shortCode);
      }
      const acknowledgedAt =
        hasFreshRing
          ? null
          : options?.acknowledgedAt ??
            previous?.riderOutsideAcknowledgedAt ??
            (acknowledgedAtFromMemory ? new Date().toISOString() : null);
      if (acknowledgedAt) {
        markRiderOutsideAcknowledged(shortCode, acknowledgedAt);
        return;
      }
      const alreadyNotified =
        riderOutsideAnnounced.current.has(shortCode) ||
        previous?.riderOutsideNotified === true;
      const loopAlreadyRunning = riderOutsideLoopTimers.current.has(shortCode);

      startRiderOutsideLoop(shortCode);

      riderOutsideAnnounced.current.add(shortCode);
      if (options?.force || hasFreshRing || !alreadyNotified || !loopAlreadyRunning) {
        showToast({
          key: Date.now(),
          shortCode,
          status: "rider_outside",
          serviceMode: "delivery",
          rejectedReason: null,
        });
      }

      upsertStoredOrder({
        shortCode,
        status: previous?.status ?? "out_for_delivery",
        serviceMode: previous?.serviceMode ?? "delivery",
        riderOutsideNotified: true,
        riderOutsideRingAt: options?.ringAt ?? previous?.riderOutsideRingAt ?? null,
        riderOutsideAcknowledgedAt:
          hasFreshRing ? null : previous?.riderOutsideAcknowledgedAt ?? null,
      });
      syncTrackedOrders();

      // Re-render any open tracking page so the "Rider outside" timeline step
      // lights up immediately instead of waiting for the next poll.
      scheduleRefresh();
    },
    [
      markRiderOutsideAcknowledged,
      scheduleRefresh,
      showToast,
      startRiderOutsideLoop,
      syncTrackedOrders,
    ]
  );

  const announceRiderOutside = useCallback(
    (payload: CustomerRiderOutsidePayload) => {
      fireRiderOutside(payload.shortCode, {
        force: true,
        ringAt: payload.sentAt,
      });
    },
    [fireRiderOutside]
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
              readyAcknowledgedAt: order.readyAcknowledgedAt,
              changedAt: new Date().toISOString(),
            },
            mode
          );
          // Reliable fallback for the rider-outside alert: a missed broadcast
          // is still caught here within the poll interval, and the alarm keeps
          // ringing until the customer acknowledgement is persisted.
          if (!canRingRiderOutside(order.status, order.serviceMode)) {
            stopRiderOutsideLoop(order.shortCode);
            continue;
          }
          if (order.riderAcknowledgedAt) {
            fireRiderOutside(order.shortCode, {
              acknowledgedAt: order.riderAcknowledgedAt,
            });
            continue;
          }
          if (order.riderRingAt) {
            fireRiderOutside(order.shortCode, { ringAt: order.riderRingAt });
          } else if (order.riderArrived) {
            fireRiderOutside(order.shortCode);
          }
        }
      } catch {
        // Realtime subscriptions and the next snapshot will catch up.
      } finally {
        snapshotInFlight.current = false;
      }
    },
    [
      disabled,
      fireRiderOutside,
      hasCustomerSession,
      reconcileOrder,
      stopRiderOutsideLoop,
      trackedCodes,
    ]
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
        .on<CustomerRiderOutsidePayload>(
          "broadcast",
          { event: CUSTOMER_RIDER_OUTSIDE_EVENT },
          ({ payload }) => announceRiderOutside(payload)
        )
        .subscribe()
    );

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [announceRiderOutside, disabled, reconcileOrder, trackedCodes]);

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
              readyAcknowledgedAt:
                typeof next.ready_acknowledged_at === "string"
                  ? next.ready_acknowledged_at
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
      stopAllReadyLoops();
      stopAllRiderOutsideLoops();
    },
    [stopAllReadyLoops, stopAllRiderOutsideLoops]
  );

  const acknowledgeRiderOutside = useCallback(
    (rawShortCode: string) => {
      const shortCode = normalizeOrderCode(rawShortCode);
      const acknowledgedAt = new Date().toISOString();
      markRiderOutsideAcknowledged(shortCode, acknowledgedAt);
      syncTrackedOrders();
      window.dispatchEvent(
        new CustomEvent(CUSTOMER_RIDER_OUTSIDE_ACK_EVENT, {
          detail: { shortCode, riderAcknowledgedAt: acknowledgedAt },
        })
      );

      void fetch("/customer/rider-arrival-acknowledgement", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shortCode }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as {
            riderAcknowledgedAt?: unknown;
          };
          if (typeof payload.riderAcknowledgedAt !== "string") return;
          markRiderOutsideAcknowledged(shortCode, payload.riderAcknowledgedAt);
          syncTrackedOrders();
          window.dispatchEvent(
            new CustomEvent(CUSTOMER_RIDER_OUTSIDE_ACK_EVENT, {
              detail: {
                shortCode,
                riderAcknowledgedAt: payload.riderAcknowledgedAt,
              },
            })
          );
        })
        .catch(() => {
          /* Local acknowledgement already stopped the alarm; polling can resync. */
        });
    },
    [markRiderOutsideAcknowledged, syncTrackedOrders]
  );

  if (disabled) return <>{children}</>;

  const copy = toast ? toastCopy(toast.status, toast.serviceMode) : null;
  const Icon =
    toast?.status === "rejected"
      ? XCircle
      : toast?.status === "rider_outside"
        ? DoorOpen
        : toast?.status === "out_for_delivery"
          ? Truck
          : CheckCircle2;

  const showEnableSound = !audioReady && trackedCodes.length > 0;

  return (
    <>
      {children}

      {showEnableSound && (
        <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-4">
          <button
            type="button"
            onClick={enableSound}
            className="zb-reveal inline-flex items-center gap-2 rounded-full border border-zb-bone/50 bg-zb-primary-dark/95 px-4 py-2.5 text-sm font-semibold text-zb-bone shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-zb-bone/80 hover:bg-zb-primary-dark"
          >
            <BellRing className="size-4" aria-hidden />
            Tap to enable order sound alerts
          </button>
        </div>
      )}

      {toast && copy && toast.status === "rider_outside" && (
        <div
          key={toast.key}
          className="zb-toast-in fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-full max-w-md rounded-xl border border-zb-bone/55 bg-zb-primary-dark/95 px-4 py-3 shadow-[0_22px_60px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zb-bone/15 text-zb-bone">
                <DoorOpen className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zb-cream">
                  {copy.title} {toast.shortCode}
                </p>
                <p className="truncate text-xs text-zb-cream/60">
                  {copy.detail}
                </p>
              </div>
              <BellRing className="size-4 shrink-0 text-zb-cream/45" aria-hidden />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => router.push(`/order/${toast.shortCode}`)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zb-bone/35 px-3 text-xs font-bold text-zb-cream transition hover:bg-zb-bone/10"
              >
                View order
              </button>
              <button
                type="button"
                onClick={() => acknowledgeRiderOutside(toast.shortCode)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-zb-bone px-3 text-xs font-bold text-zb-primary-dark transition hover:bg-zb-bone-soft"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                I&apos;m coming
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && copy && toast.status !== "rider_outside" && (
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
