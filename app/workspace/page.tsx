import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/peso";
import type { OrderStatus } from "@/app/workspace/orders/actions";

export const dynamic = "force-dynamic";

// Start of "today" in Asia/Manila (UTC+8, no DST), as a UTC ISO string.
function manilaTodayStartISO(): string {
  const ph = new Date(Date.now() + 8 * 3600 * 1000);
  const midnightUtc =
    Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()) -
    8 * 3600 * 1000;
  return new Date(midnightUtc).toISOString();
}

const ACTIVE: OrderStatus[] = ["accepted", "preparing", "ready", "out_for_delivery"];

export default async function AdminDashboard() {
  const { profile } = await requireStaff("/workspace");
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("status, total_cents, payments ( status )")
    .gte("placed_at", manilaTodayStartISO());

  const rows =
    (data as Array<{
      status: OrderStatus;
      total_cents: number;
      payments: Array<{ status: string }> | null;
    }> | null) ?? [];

  const total = rows.length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const inKitchen = rows.filter((r) => ACTIVE.includes(r.status)).length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const revenue = rows
    .filter((r) => r.payments?.[0]?.status === "paid")
    .reduce((sum, r) => sum + r.total_cents, 0);

  const cards = [
    { label: "Orders today", value: String(total) },
    { label: "Awaiting review", value: String(pending), hot: pending > 0 },
    { label: "In the kitchen", value: String(inKitchen) },
    { label: "Completed", value: String(completed) },
    { label: "Revenue (paid)", value: formatPeso(revenue) },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl text-zb-cream">
        GOOD DAY, {profile.display_name.split(" ")[0]?.toUpperCase()}
      </h1>
      <p className="text-sm text-zb-cream/55">Today at Zombeans</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
