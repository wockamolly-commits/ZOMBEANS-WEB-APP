import { NextResponse } from "next/server";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { normalizeOrderCode } from "@/lib/customer-order-realtime";

export const dynamic = "force-dynamic";

type RequestBody = {
  shortCode?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (typeof body.shortCode !== "string") {
    return NextResponse.json({ error: "Missing order code." }, { status: 400 });
  }

  const shortCode = normalizeOrderCode(body.shortCode);
  if (!shortCode) {
    return NextResponse.json({ error: "Missing order code." }, { status: 400 });
  }

  const supabase = await createReadOnlyClient();
  const { data, error } = await supabase.rpc(
    "customer_acknowledge_ready_order",
    {
      p_code: shortCode,
    }
  );

  if (error) {
    console.error("[customer] ready acknowledgement failed:", error);
    return NextResponse.json(
      { error: "Could not save acknowledgement." },
      { status: 500 }
    );
  }

  if (typeof data !== "string" || data.length === 0) {
    return NextResponse.json(
      { error: "Order is not ready for acknowledgement." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    shortCode,
    readyAcknowledgedAt: data,
  });
}
