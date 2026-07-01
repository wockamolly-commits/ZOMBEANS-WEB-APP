import { NextResponse } from "next/server";
import { getTeamProfileForUser } from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const dynamic = "force-dynamic";

type AlertStatus = "ready" | "out_for_delivery" | "completed";
type Embedded<T> = T | T[] | null;

type AlertAssignmentRow = {
  order_id: string;
  assigned_at: string;
  orders:
    | {
        id: string;
        short_code: string;
        status: AlertStatus;
      }
    | Array<{
        id: string;
        short_code: string;
        status: AlertStatus;
      }>;
};

const ALERT_STATUSES: readonly AlertStatus[] = [
  "ready",
  "out_for_delivery",
  "completed",
];

function toOne<T>(value: Embedded<T> | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function recentSinceISO(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ deliveries: [] }, { status: 401 });
  }

  const profile = await getTeamProfileForUser(supabase, user.id);
  if (!profile || profile.role !== "rider" || profile.staff_role !== "rider") {
    return NextResponse.json({ deliveries: [] }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("rider_assignments")
    .select(
      `order_id, assigned_at,
       orders!inner (
         id, short_code, status
       )`
    )
    .eq("rider_profile_id", profile.id)
    .gte("assigned_at", recentSinceISO())
    .order("assigned_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[rider-alerts] snapshot failed:", error.message);
    return NextResponse.json(
      { deliveries: [], error: "SNAPSHOT_FAILED" },
      { status: 500 }
    );
  }

  const deliveries = ((data as AlertAssignmentRow[] | null) ?? []).flatMap(
    (row) => {
      const order = toOne(row.orders);
      if (!order || !ALERT_STATUSES.includes(order.status)) return [];
      return {
        orderId: row.order_id,
        assignedAt: row.assigned_at,
        shortCode: order.short_code,
        status: order.status,
      };
    }
  );

  return NextResponse.json({ deliveries });
}
