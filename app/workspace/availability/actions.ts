"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireStaffPermission } from "@/lib/admin";
import { getCloseHour } from "@/lib/checkout";
import {
  clampHighDemandMinutes,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
} from "@/lib/store-availability";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type StoreActionResult =
  | { ok: true }
  | { ok: false; error: string };

const reasonCode = z.enum([
  "today",
  "temporary",
  "kitchen",
  "inventory",
  "maintenance",
  "custom",
]);

const closedSchema = z.object({
  reasonCode,
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const highDemandSchema = z.object({
  enabled: z.boolean(),
  minutes: z.number().int().optional(),
});

function refresh() {
  revalidatePath("/workspace", "layout");
  revalidatePath("/menu");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

async function audit(
  actorId: string,
  action: string,
  diff: Record<string, unknown>
) {
  const admin = await createAdminSessionClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_profile_id: actorId,
    action,
    target_table: "app_settings",
    target_id: "1",
    diff,
  });
  if (error) console.error("[store-availability] audit failed:", error.message);
}

// End of today's operating window in Asia/Manila, as an ISO timestamp.
function endOfSlotISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const closeHour = getCloseHour(dayMap[get("weekday")] ?? now.getDay());
  // Build the Manila wall-clock close time, then convert to UTC by comparing
  // the Manila offset. Manila has no DST (UTC+8), so a fixed offset is safe.
  const iso = `${get("year")}-${get("month")}-${get("day")}T${String(
    closeHour
  ).padStart(2, "0")}:00:00+08:00`;
  return new Date(iso).toISOString();
}

export async function setStoreOpen(): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const admin = await createAdminSessionClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      accepting_orders: true,
      closure_reason_code: null,
      closure_note: null,
      closed_until: null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not reopen the store." };
  await audit(profile.id, "store.opened", { accepting_orders: true });
  refresh();
  return { ok: true };
}

export async function setStoreClosed(
  input: z.input<typeof closedSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = closedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const { reasonCode: code, note, until } = parsed.data;

  if (code === "custom" && !note?.trim()) {
    return { ok: false, error: "Add a short reason for the closure." };
  }

  let closedUntil: string | null = until ?? null;
  if (code === "today" && !closedUntil) {
    closedUntil = endOfSlotISO();
  }
  if (closedUntil && new Date(closedUntil).getTime() <= Date.now()) {
    return { ok: false, error: "Choose a future reopening time." };
  }

  const admin = await createAdminSessionClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      accepting_orders: false,
      closure_reason_code: code,
      closure_note: code === "custom" ? note?.trim() ?? null : note?.trim() || null,
      closed_until: closedUntil,
      high_demand: false,
      high_demand_minutes: null,
      high_demand_until: null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not close the store." };
  await audit(profile.id, "store.closed", {
    closure_reason_code: code,
    closed_until: closedUntil,
  });
  refresh();
  return { ok: true };
}

export async function setHighDemand(
  input: z.input<typeof highDemandSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = highDemandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid high-demand request." };
  const admin = await createAdminSessionClient();

  if (!parsed.data.enabled) {
    const { error } = await admin
      .from("app_settings")
      .update({
        high_demand: false,
        high_demand_minutes: null,
        high_demand_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not update high-demand mode." };
    await audit(profile.id, "store.high_demand_off", {});
    refresh();
    return { ok: true };
  }

  // Guard: high demand only makes sense while the store is accepting orders.
  const current = await admin
    .from("app_settings")
    .select("accepting_orders")
    .eq("id", 1)
    .single();
  if (current.error) return { ok: false, error: "Could not update high-demand mode." };
  if (!current.data.accepting_orders) {
    return { ok: false, error: "Open the store before enabling high demand." };
  }

  const minutes = clampHighDemandMinutes(
    parsed.data.minutes ?? HIGH_DEMAND_DEFAULT_MINUTES
  );
  const until = new Date(
    Date.now() + HIGH_DEMAND_WINDOW_MINUTES * 60_000
  ).toISOString();

  const { error } = await admin
    .from("app_settings")
    .update({
      high_demand: true,
      high_demand_minutes: minutes,
      high_demand_until: until,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not update high-demand mode." };
  await audit(profile.id, "store.high_demand_on", { minutes, until });
  refresh();
  return { ok: true };
}
