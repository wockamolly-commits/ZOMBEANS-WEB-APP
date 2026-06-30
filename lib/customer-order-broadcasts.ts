import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CUSTOMER_ORDER_EVENT,
  customerOrderTopic,
  type CustomerServiceMode,
  type CustomerOrderStatus,
  type CustomerOrderStatusPayload,
} from "@/lib/customer-order-realtime";

type OrderBroadcastRow = {
  short_code: string;
  status: CustomerOrderStatus;
  service_mode: CustomerServiceMode;
  rejected_reason: string | null;
};

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

    const channel = supabase.channel(customerOrderTopic(row.short_code));
    try {
      const result = await channel.httpSend(CUSTOMER_ORDER_EVENT, payload, {
        timeout: 3_000,
      });
      if (!result.success) {
        console.error(
          "[customer-order-broadcast] send failed:",
          result.status,
          result.error
        );
      }
    } finally {
      await supabase.removeChannel(channel);
    }
  } catch (error) {
    console.error("[customer-order-broadcast] unexpected failure:", error);
  }
}
