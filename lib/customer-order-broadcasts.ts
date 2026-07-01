import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOrder } from "@/lib/push-notifications";
import {
  CUSTOMER_ORDER_EVENT,
  CUSTOMER_RIDER_OUTSIDE_EVENT,
  customerOrderTopic,
  isCustomerOrderAlert,
  type CustomerServiceMode,
  type CustomerOrderStatus,
  type CustomerOrderStatusPayload,
  type CustomerRiderOutsidePayload,
} from "@/lib/customer-order-realtime";

function customerPushCopy(
  status: CustomerOrderStatus,
  serviceMode: CustomerServiceMode | null,
  rejectedReason: string | null
): { title: string; body: string } {
  if (status === "rejected") {
    return {
      title: "Order rejected",
      body: rejectedReason ?? "Tap to view the reason and next steps.",
    };
  }
  if (status === "completed") {
    return serviceMode === "delivery"
      ? { title: "Order delivered", body: "Your delivery has arrived. Enjoy!" }
      : { title: "Order completed", body: "Thanks for ordering from Zombeans." };
  }
  if (status === "out_for_delivery") {
    return {
      title: "Order out for delivery",
      body: "Your rider is on the way with your order.",
    };
  }
  // ready
  if (serviceMode === "delivery") {
    return {
      title: "Order ready for delivery",
      body: "Your delivery order is packed and waiting for a rider.",
    };
  }
  return {
    title:
      serviceMode === "dine_in" ? "Order ready for serving" : "Order ready for pickup",
    body:
      serviceMode === "dine_in"
        ? "Your dine-in order is ready to be claimed or served."
        : "Your pickup order is ready at the counter.",
  };
}

type OrderBroadcastRow = {
  short_code: string;
  status: CustomerOrderStatus;
  service_mode: CustomerServiceMode;
  rejected_reason: string | null;
};

async function sendCustomerBroadcast(
  supabase: ReturnType<typeof createAdminClient>,
  shortCode: string,
  event: string,
  payload: CustomerOrderStatusPayload | CustomerRiderOutsidePayload,
  logLabel: string
) {
  const serverSecret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serverSecret) {
    await supabase.realtime.setAuth(serverSecret);
  }

  const channel = supabase.channel(customerOrderTopic(shortCode));
  try {
    try {
      const result = await channel.httpSend(event, payload, { timeout: 3_000 });
      if (result.success) return true;
      console.error(
        `[customer-order-broadcast] ${logLabel} http send failed:`,
        result.status,
        result.error
      );
    } catch (error) {
      console.error(
        `[customer-order-broadcast] ${logLabel} http send threw:`,
        error
      );
    }

    // Fallback for Realtime deployments that do not support the newer
    // per-event REST endpoint used by httpSend().
    const fallback = await channel.send(
      { type: "broadcast", event, payload },
      { timeout: 3_000 }
    );
    if (fallback === "ok") return true;
    console.error(
      `[customer-order-broadcast] ${logLabel} fallback send failed:`,
      fallback
    );
    return false;
  } finally {
    await supabase.removeChannel(channel);
  }
}

export async function broadcastCustomerOrderStatus(orderId: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("short_code, status, service_mode, rejected_reason")
      .eq("id", orderId)
      .single();

    if (error || !data) {
      console.error(
        "[customer-order-broadcast] order lookup failed:",
        error?.message ?? "missing row"
      );
      return;
    }

    const row = data as OrderBroadcastRow;
    const payload: CustomerOrderStatusPayload = {
      shortCode: row.short_code,
      status: row.status,
      serviceMode: row.service_mode,
      rejectedReason: row.rejected_reason,
      changedAt: new Date().toISOString(),
    };

    await sendCustomerBroadcast(
      supabase,
      row.short_code,
      CUSTOMER_ORDER_EVENT,
      payload,
      "order-status"
    );

    if (isCustomerOrderAlert(row.status, row.service_mode)) {
      const { title, body } = customerPushCopy(
        row.status,
        row.service_mode,
        row.rejected_reason
      );
      sendPushToOrder(row.short_code, {
        title,
        body,
        url: `/order/${row.short_code}`,
        tag: `order-status:${row.short_code}`,
        // "Ready" is the moment the customer must act on, so buzz harder.
        vibrate:
          row.status === "ready"
            ? [240, 80, 240, 80, 360]
            : [160, 70, 160],
        requireInteraction: row.status === "ready",
      });
    }
  } catch (error) {
    console.error("[customer-order-broadcast] unexpected failure:", error);
  }
}

export async function broadcastRiderOutside(orderId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("short_code")
      .eq("id", orderId)
      .single();

    if (error || !data) {
      console.error(
        "[customer-order-broadcast] rider-outside lookup failed:",
        error?.message ?? "missing row"
      );
      return false;
    }

    const row = data as Pick<OrderBroadcastRow, "short_code">;
    const { data: ringData } = await supabase
      .from("rider_assignments")
      .select("customer_ring_at")
      .eq("order_id", orderId)
      .not("customer_ring_at", "is", null)
      .order("customer_ring_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ringAt =
      typeof ringData?.customer_ring_at === "string"
        ? ringData.customer_ring_at
        : new Date().toISOString();
    const payload: CustomerRiderOutsidePayload = {
      shortCode: row.short_code,
      ringId: randomUUID(),
      sentAt: ringAt,
    };

    const sent = await sendCustomerBroadcast(
      supabase,
      row.short_code,
      CUSTOMER_RIDER_OUTSIDE_EVENT,
      payload,
      "rider-outside"
    );

    sendPushToOrder(row.short_code, {
      title: "Your rider is outside",
      body: "Your rider is already outside your house. Please meet them to receive your order.",
      url: `/order/${row.short_code}`,
      tag: `rider-outside:${row.short_code}`,
      // Door-knock buzz; keep on screen and re-alert on every re-notify since
      // the customer needs to physically go meet the rider.
      vibrate: [200, 90, 200, 90, 200, 90, 360],
      requireInteraction: true,
      renotify: true,
    });

    return sent;
  } catch (error) {
    console.error(
      "[customer-order-broadcast] rider-outside unexpected failure:",
      error
    );
    return false;
  }
}
