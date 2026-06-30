import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminOrderAlert,
  AdminOrderAlertSnapshot,
} from "@/lib/admin-order-alert-types";
import { recentOrdersSinceISO } from "@/lib/admin-order-dates";

type AlertRow = {
  id: string;
  short_code: string;
  placed_at: string;
  service_mode: AdminOrderAlert["serviceMode"];
  customer_name: string;
  total_cents: number;
  order_items: Array<{ qty: number }> | null;
};

const ALERT_LIMIT = 50;

export async function getAdminOrderAlertSnapshot(
  supabase: SupabaseClient
): Promise<AdminOrderAlertSnapshot> {
  const { data, count, error } = await supabase
    .from("orders")
    .select(
      `id, short_code, placed_at, service_mode, customer_name, total_cents,
       order_items ( qty )`,
      { count: "exact" }
    )
    .eq("status", "pending")
    .gte("placed_at", recentOrdersSinceISO())
    .order("placed_at", { ascending: false })
    .limit(ALERT_LIMIT);

  if (error) {
    console.error("[admin-alerts] snapshot failed:", error.message);
    return { pendingCount: 0, orders: [] };
  }

  const orders = ((data as AlertRow[] | null) ?? []).map((row) => ({
    id: row.id,
    shortCode: row.short_code,
    placedAt: row.placed_at,
    serviceMode: row.service_mode,
    customerName: row.customer_name,
    totalCents: row.total_cents,
    itemCount: (row.order_items ?? []).reduce((sum, item) => sum + item.qty, 0),
  }));

  return {
    pendingCount: count ?? orders.length,
    orders,
  };
}
