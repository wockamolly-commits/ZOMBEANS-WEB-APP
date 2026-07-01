import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { getRiderProfile } from "@/lib/rider";
import { normalizeOrderCode } from "@/lib/customer-order-realtime";

export const dynamic = "force-dynamic";

type RequestBody = {
  role?: unknown;
  orderCode?: unknown;
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const role = body.role;
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const authKey = body.subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof authKey !== "string"
  ) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (role === "customer") {
    const orderCode =
      typeof body.orderCode === "string" ? normalizeOrderCode(body.orderCode) : "";
    if (!orderCode) {
      return NextResponse.json({ error: "orderCode is required." }, { status: 400 });
    }

    const readOnly = await createReadOnlyClient();
    const { data: order } = await readOnly.rpc("get_order_by_code", {
      p_code: orderCode,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        role: "customer",
        order_code: orderCode,
        user_id: null,
        endpoint,
        p256dh,
        auth_key: authKey,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      console.error("[push/subscribe] customer upsert failed:", error);
      return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (role === "rider") {
    const profile = await getRiderProfile();
    if (!profile) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        role: "rider",
        order_code: null,
        user_id: profile.id,
        endpoint,
        p256dh,
        auth_key: authKey,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      console.error("[push/subscribe] rider upsert failed:", error);
      return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid role." }, { status: 400 });
}
