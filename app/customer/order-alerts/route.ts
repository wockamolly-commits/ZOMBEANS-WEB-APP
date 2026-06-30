import { NextResponse } from "next/server";
import { createReadOnlyClient } from "@/lib/supabase/server";
import {
  normalizeOrderCode,
  type CustomerServiceMode,
  type CustomerOrderStatus,
} from "@/lib/customer-order-realtime";

export const dynamic = "force-dynamic";

type RequestBody = {
  codes?: unknown;
};

type RpcOrder = {
  short_code: string;
  status: CustomerOrderStatus;
  service_mode: CustomerServiceMode;
  rejected_reason: string | null;
};

type OwnedOrderRow = {
  short_code: string;
  status: CustomerOrderStatus;
  service_mode: CustomerServiceMode;
  rejected_reason: string | null;
};

function parseCodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((code): code is string => typeof code === "string")
        .map(normalizeOrderCode)
        .filter(Boolean)
    )
  ).slice(0, 12);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const codes = parseCodes(body.codes);
  const supabase = await createReadOnlyClient();
  const orders = new Map<
    string,
    {
      shortCode: string;
      status: CustomerOrderStatus;
      serviceMode: CustomerServiceMode | null;
      rejectedReason: string | null;
    }
  >();

  for (const code of codes) {
    const { data } = await supabase.rpc("get_order_by_code", {
      p_code: code,
    });
    const order = data as RpcOrder | null;
    if (!order?.short_code || !order.status) continue;
    orders.set(normalizeOrderCode(order.short_code), {
      shortCode: normalizeOrderCode(order.short_code),
      status: order.status,
      serviceMode: order.service_mode,
      rejectedReason: order.rejected_reason,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data, error } = await supabase
      .from("orders")
      .select("short_code, status, service_mode, rejected_reason")
      .eq("user_id", user.id)
      .gte(
        "placed_at",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("placed_at", { ascending: false })
      .limit(20);

    if (!error) {
      for (const row of ((data as OwnedOrderRow[] | null) ?? [])) {
        orders.set(normalizeOrderCode(row.short_code), {
          shortCode: normalizeOrderCode(row.short_code),
          status: row.status,
          serviceMode: row.service_mode,
          rejectedReason: row.rejected_reason,
        });
      }
    }
  }

  return NextResponse.json({ orders: Array.from(orders.values()) });
}
