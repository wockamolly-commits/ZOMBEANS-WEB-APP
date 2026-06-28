import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaffPermission } from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { formatPeso } from "@/lib/peso";
import { manilaTodayStartISO } from "@/lib/admin-order-dates";
import type { OrderStatus } from "@/app/workspace/orders/actions";

export const dynamic = "force-dynamic";

const ACTIVE: OrderStatus[] = ["accepted", "preparing", "ready", "out_for_delivery"];

export default async function AdminDashboard() {
  const { profile } = await requireStaffPermission("dashboard:view", "/workspace");
  const supabase = await createAdminSessionClient();

  const { data } = await supabase
    .from("orders")
    .select("status, total_cents, is_test, payments ( status )")
    .gte("placed_at", manilaTodayStartISO());

  const rows =
    (data as Array<{
      status: OrderStatus;
      total_cents: number;
      is_test: boolean;
      payments: Array<{ status: string }> | null;
    }> | null) ?? [];

  const liveRows = rows.filter((row) => !row.is_test);
  const testOrders = rows.length - liveRows.length;
  const total = liveRows.length;
  const pending = liveRows.filter((r) => r.status === "pending").length;
  const inKitchen = liveRows.filter((r) => ACTIVE.includes(r.status)).length;
  const completed = liveRows.filter((r) => r.status === "completed").length;
  const revenue = liveRows
    .filter((r) => r.payments?.[0]?.status === "paid")
    .reduce((sum, r) => sum + r.total_cents, 0);

  const cards = [
    { label: "Orders today", value: String(total) },
    { label: "Awaiting review", value: String(pending), hot: pending > 0 },
    { label: "In the kitchen", value: String(inKitchen) },
    { label: "Completed", value: String(completed) },
    { label: "Revenue (paid)", value: formatPeso(revenue) },
    { label: "Test orders", value: String(testOrders) },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl text-zb-cream">
        GOOD DAY, {profile.display_name.split(" ")[0]?.toUpperCase()}
      </h1>
      <p className="text-sm text-zb-cream/55">Today at Zombeans</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-4 ${
              c.hot
                ? "border-zb-bone/50 bg-zb-bone/10"
                : "border-zb-sage/25 bg-zb-primary-strong/60"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-zb-cream/55">
              {c.label}
            </p>
            <p
              className={`mt-1 font-mono-tabular text-2xl font-bold ${
                c.hot ? "text-zb-bone" : "text-zb-cream"
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/workspace/orders"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zb-bone px-4 py-2.5 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone/85"
      >
        Go to live orders <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
