"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, DoorOpen } from "lucide-react";
import {
  CUSTOMER_ORDER_STORAGE_KEY,
  CUSTOMER_ORDER_TRACKING_EVENT,
  CUSTOMER_RIDER_OUTSIDE_ACK_EVENT,
  normalizeOrderCode,
  type CustomerOrderStatus,
} from "@/lib/customer-order-realtime";

type StoredCustomerOrder = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode?: "dine_in" | "take_out" | "pickup" | "delivery" | null;
  notifiedStatus?: CustomerOrderStatus;
  readyAcknowledgedAt?: string | null;
  riderOutsideNotified?: boolean;
  riderOutsideRingAt?: string | null;
  riderOutsideAcknowledgedAt?: string | null;
  updatedAt: string;
};

const MAX_STORED_ORDERS = 12;

function readStoredOrders(): StoredCustomerOrder[] {
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
              ? candidate.serviceMode
              : null,
          notifiedStatus: candidate.notifiedStatus,
          readyAcknowledgedAt:
            typeof candidate.readyAcknowledgedAt === "string"
              ? candidate.readyAcknowledgedAt
              : null,
          riderOutsideNotified:
            candidate.riderOutsideNotified === true ? true : undefined,
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
  window.localStorage.setItem(
    CUSTOMER_ORDER_STORAGE_KEY,
    JSON.stringify(orders.slice(0, MAX_STORED_ORDERS))
  );
  window.dispatchEvent(new Event(CUSTOMER_ORDER_TRACKING_EVENT));
}

export function RiderArrivalAcknowledgementButton({
  shortCode,
  initialAcknowledgedAt = null,
}: {
  shortCode: string;
  initialAcknowledgedAt?: string | null;
}) {
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(
    initialAcknowledgedAt
  );

  const syncAcknowledgement = useCallback(() => {
    const normalized = normalizeOrderCode(shortCode);
    const order = readStoredOrders().find(
      (entry) => entry.shortCode === normalized
    );
    setAcknowledgedAt(
      order?.riderOutsideAcknowledgedAt ?? initialAcknowledgedAt
    );
  }, [initialAcknowledgedAt, shortCode]);

  const saveAcknowledgement = useCallback(
    async (normalized: string, fallbackAt: string) => {
      try {
        const response = await fetch("/customer/rider-arrival-acknowledgement", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shortCode: normalized }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          riderAcknowledgedAt?: unknown;
        };
        if (typeof payload.riderAcknowledgedAt !== "string") return;

        const orders = readStoredOrders();
        const previous = orders.find((order) => order.shortCode === normalized);
        const rest = orders.filter((order) => order.shortCode !== normalized);
        rest.unshift({
          shortCode: normalized,
          status: previous?.status ?? "out_for_delivery",
          serviceMode: previous?.serviceMode ?? "delivery",
          notifiedStatus: previous?.notifiedStatus ?? "out_for_delivery",
          readyAcknowledgedAt: previous?.readyAcknowledgedAt ?? null,
          riderOutsideNotified: true,
          riderOutsideRingAt: previous?.riderOutsideRingAt ?? null,
          riderOutsideAcknowledgedAt: payload.riderAcknowledgedAt,
          updatedAt: fallbackAt,
        });

        writeStoredOrders(rest);
        window.dispatchEvent(
          new CustomEvent(CUSTOMER_RIDER_OUTSIDE_ACK_EVENT, {
            detail: {
              shortCode: normalized,
              riderAcknowledgedAt: payload.riderAcknowledgedAt,
            },
          })
        );
        setAcknowledgedAt(payload.riderAcknowledgedAt);
      } catch {
        /* Local acknowledgement already stopped the alarm; polling can resync. */
      }
    },
    []
  );

  useEffect(() => {
    const syncTimer = window.setTimeout(syncAcknowledgement, 0);

    const onStorage = (event: StorageEvent) => {
      if (event.key === CUSTOMER_ORDER_STORAGE_KEY) syncAcknowledgement();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CUSTOMER_ORDER_TRACKING_EVENT, syncAcknowledgement);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        CUSTOMER_ORDER_TRACKING_EVENT,
        syncAcknowledgement
      );
    };
  }, [syncAcknowledgement]);

  const acknowledgeArrival = useCallback(() => {
    const normalized = normalizeOrderCode(shortCode);
    const receivedAt = new Date().toISOString();
    const orders = readStoredOrders();
    const previous = orders.find((order) => order.shortCode === normalized);
    const rest = orders.filter((order) => order.shortCode !== normalized);

    rest.unshift({
      shortCode: normalized,
      status: previous?.status ?? "out_for_delivery",
      serviceMode: previous?.serviceMode ?? "delivery",
      notifiedStatus: previous?.notifiedStatus ?? "out_for_delivery",
      readyAcknowledgedAt: previous?.readyAcknowledgedAt ?? null,
      riderOutsideNotified: true,
      riderOutsideRingAt: previous?.riderOutsideRingAt ?? null,
      riderOutsideAcknowledgedAt: receivedAt,
      updatedAt: receivedAt,
    });

    writeStoredOrders(rest);
    window.dispatchEvent(
      new CustomEvent(CUSTOMER_RIDER_OUTSIDE_ACK_EVENT, {
        detail: { shortCode: normalized, riderAcknowledgedAt: receivedAt },
      })
    );
    setAcknowledgedAt(receivedAt);
    void saveAcknowledgement(normalized, receivedAt);
  }, [saveAcknowledgement, shortCode]);

  if (acknowledgedAt) {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-zb-sage/35 bg-zb-sage/10 px-4 py-3 text-sm font-semibold text-zb-cream">
        <CheckCircle2 className="size-5 shrink-0 text-zb-bone" aria-hidden />
        Rider arrival acknowledged
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-zb-bone/55 bg-zb-bone/12 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.25)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zb-bone text-zb-primary-dark">
          <DoorOpen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zb-cream">
            Your rider is outside
          </p>
          <p className="mt-1 text-xs leading-5 text-zb-cream/65">
            Tap once you have seen the alert and are heading out.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={acknowledgeArrival}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 text-sm font-bold text-zb-primary-dark shadow-lg transition hover:bg-zb-bone-soft focus:outline-none focus:ring-2 focus:ring-zb-bone/70 focus:ring-offset-2 focus:ring-offset-zb-primary-dark"
      >
        <CheckCircle2 className="size-5" aria-hidden />
        Acknowledge Rider
      </button>
    </div>
  );
}
