"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Circle,
  CreditCard,
  MapPinned,
  PackagePlus,
  RefreshCw,
  Truck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  markAllRiderNotificationsRead,
  setRiderNotificationRead,
} from "@/app/rider/actions";
import { createClient } from "@/lib/supabase/browser";
import type {
  RiderNotification,
  RiderNotificationKind,
} from "@/lib/rider-notification-types";

type Props = {
  riderProfileId: string;
  initialNotifications: RiderNotification[];
  initialUnreadCount: number;
};

const ALERTS_KEY = "zombeans:rider-assignment-alerts";

function isNotificationKind(value: unknown): value is RiderNotificationKind {
  return (
    value === "assignment" ||
    value === "order_status" ||
    value === "delivery_cancelled" ||
    value === "delivery_details" ||
    value === "payment_status"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function notificationFromRow(row: unknown): RiderNotification | null {
  const value = isRecord(row) ? row : null;
  if (!value) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.rider_profile_id !== "string" ||
    !isNotificationKind(value.kind) ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    rider_profile_id: value.rider_profile_id,
    order_id: typeof value.order_id === "string" ? value.order_id : null,
    kind: value.kind,
    title: value.title,
    body: value.body,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    read_at: typeof value.read_at === "string" ? value.read_at : null,
    created_at: value.created_at,
  };
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function notificationHref(notification: RiderNotification): string {
  if (notification.kind === "delivery_cancelled") return "/rider";
  return notification.order_id
    ? `/rider/delivery/${notification.order_id}`
    : "/rider/notifications";
}

function playAssignmentAlert() {
  if ("vibrate" in navigator) {
    navigator.vibrate([180, 80, 180]);
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.addEventListener("ended", () => void context.close());
}

function useRiderNotifications({
  riderProfileId,
  initialNotifications,
  initialUnreadCount,
  maxItems,
  playAlerts,
}: Props & { maxItems: number; playAlerts: boolean }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const notificationsRef = useRef(notifications);
  const alertsRef = useRef(playAlerts);

  useEffect(() => {
    queueMicrotask(() => {
      setNotifications(initialNotifications);
      setUnreadCount(initialUnreadCount);
    });
  }, [initialNotifications, initialUnreadCount]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    alertsRef.current = playAlerts;
  }, [playAlerts]);

  useEffect(() => {
    let interval: number | undefined;
    const supabase = createClient();
    const startFallback = () => {
      if (interval !== undefined) return;
      interval = window.setInterval(() => router.refresh(), 15_000);
    };
    const stopFallback = () => {
      if (interval === undefined) return;
      window.clearInterval(interval);
      interval = undefined;
    };

    const channel = supabase
      .channel(`rider-notifications:${riderProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_notifications",
          filter: `rider_profile_id=eq.${riderProfileId}`,
        },
        (payload) => {
          const next = notificationFromRow(payload.new);
          if (!next) return;

          const previous = notificationsRef.current.find(
            (notification) => notification.id === next.id
          );
          setNotifications((current) => {
            const exists = current.some(
              (notification) => notification.id === next.id
            );
            const merged = exists
              ? current.map((notification) =>
                  notification.id === next.id ? next : notification
                )
              : [next, ...current];
            return merged
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
              .slice(0, maxItems);
          });

          if (!previous && !next.read_at) {
            setUnreadCount((count) => count + 1);
          } else if (previous?.read_at && !next.read_at) {
            setUnreadCount((count) => count + 1);
          } else if (!previous?.read_at && next.read_at) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }

          if (!previous && next.kind === "assignment" && alertsRef.current) {
            playAssignmentAlert();
          }

          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
          setError(null);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          startFallback();
          setError("Live updates paused. Refreshing in the background.");
        }
      });

    return () => {
      stopFallback();
      void supabase.removeChannel(channel);
    };
  }, [maxItems, riderProfileId, router]);

  function setLocalRead(notificationId: string, read: boolean) {
    const current = notificationsRef.current.find(
      (notification) => notification.id === notificationId
    );
    if (!current || Boolean(current.read_at) === read) return;

    setNotifications((items) =>
      items.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read_at: read ? new Date().toISOString() : null,
            }
          : notification
      )
    );
    setUnreadCount((count) =>
      read ? Math.max(0, count - 1) : count + 1
    );
  }

  function toggleRead(notificationId: string, read: boolean) {
    setError(null);
    setPendingIds((ids) => new Set(ids).add(notificationId));
    setLocalRead(notificationId, read);
    startTransition(async () => {
      const result = await setRiderNotificationRead(notificationId, read);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
      }
      setPendingIds((ids) => {
        const next = new Set(ids);
        next.delete(notificationId);
        return next;
      });
    });
  }

  function markAllRead() {
    if (unreadCount === 0) return;
    setError(null);
    setNotifications((items) =>
      items.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    startTransition(async () => {
      const result = await markAllRiderNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        router.refresh();
      }
    });
  }

  return {
    notifications,
    unreadCount,
    error,
    isPending,
    pendingIds,
    toggleRead,
    markAllRead,
  };
}

export function RiderNotificationBell(props: Props) {
  const [open, setOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const {
    notifications,
    unreadCount,
    error,
    isPending,
    pendingIds,
    toggleRead,
    markAllRead,
  } = useRiderNotifications({
    ...props,
    maxItems: 12,
    playAlerts: alertsEnabled,
  });

  useEffect(() => {
    queueMicrotask(() => {
      setAlertsEnabled(window.localStorage.getItem(ALERTS_KEY) === "1");
    });
  }, []);

  function toggleAlerts() {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    window.localStorage.setItem(ALERTS_KEY, next ? "1" : "0");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-zb-sage/25 bg-zb-primary-strong/45 text-zb-cream/70 transition hover:border-zb-bone/45 hover:bg-zb-primary hover:text-zb-bone focus-visible:border-zb-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone/35"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="size-4 text-zb-bone" />
        ) : (
          <Bell className="size-4" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-zb-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.75rem] z-50 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-xl border border-zb-sage/25 bg-zb-primary-strong shadow-2xl shadow-black/35 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[min(22rem,calc(100vw-2rem))] sm:max-h-[min(32rem,calc(100dvh-6rem))]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zb-sage/15 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-zb-cream">
                Notifications
              </p>
              <p className="text-xs text-zb-cream/45">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleAlerts}
                className="inline-flex size-8 items-center justify-center rounded-md text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-bone"
                aria-label={
                  alertsEnabled
                    ? "Disable assignment sound and vibration"
                    : "Enable assignment sound and vibration"
                }
                title={
                  alertsEnabled
                    ? "Disable assignment alerts"
                    : "Enable assignment alerts"
                }
              >
                {alertsEnabled ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={isPending || unreadCount === 0}
                className="inline-flex size-8 items-center justify-center rounded-md text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-bone disabled:opacity-35"
                aria-label="Mark all notifications read"
                title="Mark all read"
              >
                <CheckCheck className="size-4" />
              </button>
            </div>
          </div>

          <NotificationList
            notifications={notifications}
            pendingIds={pendingIds}
            compact
            onToggleRead={toggleRead}
          />

          {error && (
            <p className="shrink-0 border-t border-zb-sage/15 px-3 py-2 text-xs text-zb-bone">
              {error}
            </p>
          )}
          <Link
            href="/rider/notifications"
            onClick={() => setOpen(false)}
            className="flex h-11 shrink-0 items-center justify-center border-t border-zb-sage/15 text-sm font-semibold text-zb-bone transition hover:bg-zb-primary sm:h-10"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export function RiderNotificationsInbox(props: Props) {
  const {
    notifications,
    unreadCount,
    error,
    isPending,
    pendingIds,
    toggleRead,
    markAllRead,
  } = useRiderNotifications({
    ...props,
    maxItems: 100,
    playAlerts: false,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zb-cream/55">
          {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={markAllRead}
          disabled={isPending || unreadCount === 0}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zb-sage/30 px-3 text-sm font-semibold text-zb-cream/75 transition hover:bg-zb-primary hover:text-zb-cream disabled:opacity-40"
        >
          <CheckCheck className="size-4 text-zb-bone" />
          Mark all read
        </button>
      </div>
      {error && (
        <p className="rounded-lg border border-zb-bone/35 bg-zb-bone/10 px-3 py-2 text-sm text-zb-bone">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55">
        <NotificationList
          notifications={notifications}
          pendingIds={pendingIds}
          onToggleRead={toggleRead}
        />
      </div>
    </section>
  );
}

function NotificationList({
  notifications,
  pendingIds,
  compact,
  onToggleRead,
}: {
  notifications: RiderNotification[];
  pendingIds: Set<string>;
  compact?: boolean;
  onToggleRead: (notificationId: string, read: boolean) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-semibold text-zb-cream">No notifications yet</p>
        <p className="mt-1 text-sm text-zb-cream/45">
          Delivery updates will appear here as they happen.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        compact ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""
      }
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          compact={compact}
          pending={pendingIds.has(notification.id)}
          onToggleRead={onToggleRead}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  compact,
  pending,
  onToggleRead,
}: {
  notification: RiderNotification;
  compact?: boolean;
  pending: boolean;
  onToggleRead: (notificationId: string, read: boolean) => void;
}) {
  const unread = !notification.read_at;
  const href = notificationHref(notification);
  const time = useMemo(
    () => formatNotificationTime(notification.created_at),
    [notification.created_at]
  );

  return (
    <article
      className={`group border-b border-zb-sage/15 last:border-b-0 ${
        unread ? "bg-zb-bone/10" : ""
      }`}
    >
      <div className={`flex gap-3 ${compact ? "p-2.5 sm:p-3" : "p-4"}`}>
        <span
          className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border ${
            unread
              ? "border-zb-bone/45 bg-zb-bone/15 text-zb-bone"
              : "border-zb-sage/20 bg-zb-primary/35 text-zb-sage"
          }`}
        >
          <NotificationKindIcon kind={notification.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={href}
              onClick={() => {
                if (unread) onToggleRead(notification.id, true);
              }}
              className="min-w-0"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-zb-cream transition hover:text-zb-bone">
                <span className="truncate">{notification.title}</span>
                {unread && (
                  <span className="size-2 shrink-0 rounded-full bg-zb-bone" />
                )}
              </p>
              <p
                className={`mt-1 text-sm text-zb-cream/60 ${
                  compact ? "line-clamp-2" : ""
                }`}
              >
                {notification.body}
              </p>
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => onToggleRead(notification.id, unread)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zb-cream/45 transition hover:bg-zb-primary hover:text-zb-bone disabled:opacity-35"
              aria-label={
                unread
                  ? "Mark notification read"
                  : "Mark notification unread"
              }
              title={unread ? "Mark read" : "Mark unread"}
            >
              {pending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : unread ? (
                <Check className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
            </button>
          </div>
          <time
            dateTime={notification.created_at}
            className="mt-2 block text-xs text-zb-cream/35"
          >
            {time}
          </time>
        </div>
      </div>
    </article>
  );
}

function NotificationKindIcon({ kind }: { kind: RiderNotificationKind }) {
  switch (kind) {
    case "assignment":
      return <PackagePlus className="size-4" />;
    case "delivery_cancelled":
      return <XCircle className="size-4" />;
    case "delivery_details":
      return <MapPinned className="size-4" />;
    case "payment_status":
      return <CreditCard className="size-4" />;
    case "order_status":
    default:
      return <Truck className="size-4" />;
  }
}
