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
}: {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode: CustomerServiceMode;
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
      updatedAt,
    });

    window.localStorage.setItem(
      CUSTOMER_ORDER_STORAGE_KEY,
      JSON.stringify(orders.slice(0, MAX_STORED_ORDERS))
    );
    window.dispatchEvent(new Event(CUSTOMER_ORDER_TRACKING_EVENT));
  }, [shortCode, status, serviceMode]);

  return null;
}
