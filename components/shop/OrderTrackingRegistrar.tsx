"use client";

import { useEffect } from "react";
import {
  CUSTOMER_ORDER_STORAGE_KEY,
  CUSTOMER_ORDER_TRACKING_EVENT,
  isCustomerOrderAlert,
  isCustomerTerminalAlertStatus,
  normalizeOrderCode,
  type CustomerServiceMode,
  type CustomerOrderStatus,
} from "@/lib/customer-order-realtime";

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

const MAX_STORED_ORDERS = 12;

function readStoredOrders(): StoredCustomerOrder[] {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_ORDER_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<StoredCustomerOrder>;
      if (typeof candidate.shortCode !== "string") return [];
      if (typeof candidate.status !== "string") return [];
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

export function OrderTrackingRegistrar({
  shortCode,
  status,
  serviceMode,
  readyAcknowledgedAt,
  riderArrived,
  riderAcknowledgedAt,
}: {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode: CustomerServiceMode;
  readyAcknowledgedAt?: string | null;
  riderArrived?: boolean | null;
  riderAcknowledgedAt?: string | null;
}) {
  useEffect(() => {
    const normalized = normalizeOrderCode(shortCode);
    const updatedAt = new Date().toISOString();
    const orders = readStoredOrders().filter(
      (order) => order.shortCode !== normalized
    );
    const existing = readStoredOrders().find(
      (order) => order.shortCode === normalized
    );
    const notifiedStatus =
      existing?.notifiedStatus ??
      (isCustomerTerminalAlertStatus(status) ||
      (existing == null && isCustomerOrderAlert(status, serviceMode))
        ? status
        : undefined);

    orders.unshift({
      shortCode: normalized,
      status,
      serviceMode,
      notifiedStatus,
      readyAcknowledgedAt:
        readyAcknowledgedAt ?? existing?.readyAcknowledgedAt ?? null,
      riderOutsideNotified:
        existing?.riderOutsideNotified ??
        (riderArrived === true ? true : undefined),
      riderOutsideRingAt: existing?.riderOutsideRingAt ?? null,
      riderOutsideAcknowledgedAt:
        riderAcknowledgedAt ?? existing?.riderOutsideAcknowledgedAt ?? null,
      updatedAt,
    });

    window.localStorage.setItem(
      CUSTOMER_ORDER_STORAGE_KEY,
      JSON.stringify(orders.slice(0, MAX_STORED_ORDERS))
    );
    window.dispatchEvent(new Event(CUSTOMER_ORDER_TRACKING_EVENT));
  }, [
    readyAcknowledgedAt,
    riderAcknowledgedAt,
    riderArrived,
    shortCode,
    status,
    serviceMode,
  ]);

  return null;
}
