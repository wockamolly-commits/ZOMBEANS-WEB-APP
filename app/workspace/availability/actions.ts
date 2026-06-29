"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireStaffPermission } from "@/lib/admin";
import {
  clampHighDemandMinutes,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
} from "@/lib/store-availability";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type StoreActionResult =
  | { ok: true }
  | { ok: false; error: string };

const reasonCode = z.enum([
  "end_of_hours",
  "maintenance",
  "staff",
  "inventory",
  "emergency",
  "high_volume",
  "custom",
]);

const closureInput = z.object({
  reasonCode,
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const webstoreStatusSchema = z.object({
  open: z.boolean(),
  reasonCode: reasonCode.optional(),
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const physicalStatusSchema = z.object({
  open: z.boolean(),
  reasonCode: reasonCode.optional(),
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
  webstore: closureInput.optional(),
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
  admin: Awaited<ReturnType<typeof createAdminSessionClient>>,
  actorId: string,
  action: string,
  diff: Record<string, unknown>
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_profile_id: actorId,
    action,
    target_table: "app_settings",
    target_id: "1",
    diff,
  });
  if (error) console.error("[store-availability] audit failed:", error.message);
}

function closureFields(
  prefix: "" | "physical_",
  code: ClosureReasonCode,
  note: string | undefined,
  until: string | null | undefined
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  if (code === "custom" && !note?.trim()) {
    return { ok: false, error: "Add a short reason for the closure." };
  }
  if (until && new Date(until).getTime() <= Date.now()) {
    return { ok: false, error: "Choose a future reopening time." };
  }
  const openCol = prefix === "" ? "accepting_orders" : "physical_open";
  return {
    ok: true,
    patch: {
      [openCol]: false,
      [`${prefix}closure_reason_code`]: code,
      [`${prefix}closure_note`]:
        code === "custom" ? note?.trim() ?? null : note?.trim() || null,
      [`${prefix}closed_until`]: until ?? null,
    },
  };
}

export async function setWebstoreStatus(
  input: z.input<typeof webstoreStatusSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = webstoreStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const admin = await createAdminSessionClient();

  if (parsed.data.open) {
    const { error } = await admin
      .from("app_settings")
      .update({
        accepting_orders: true,
        closure_reason_code: null,
        closure_note: null,
        closed_until: null,
        high_demand: false,
        high_demand_minutes: null,
        high_demand_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not reopen the webstore." };
    await audit(admin, profile.id, "store.webstore_opened", {});
    refresh();
    return { ok: true };
  }

  if (!parsed.data.reasonCode) {
    return { ok: false, error: "Choose a closure reason." };
  }
  const fields = closureFields(
    "",
    parsed.data.reasonCode,
    parsed.data.note,
    parsed.data.until
  );
  if (!fields.ok) return fields;

  const patch = {
    ...fields.patch,
    high_demand: false,
    high_demand_minutes: null,
    high_demand_until: null,
  };
  const { error } = await admin.from("app_settings").update(patch).eq("id", 1);
  if (error) return { ok: false, error: "Could not close the webstore." };
  await audit(admin, profile.id, "store.webstore_closed", patch);
  refresh();
  return { ok: true };
}

export async function setPhysicalStatus(
  input: z.input<typeof physicalStatusSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = physicalStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const admin = await createAdminSessionClient();

  if (parsed.data.open) {
    const { error } = await admin
      .from("app_settings")
      .update({
        physical_open: true,
        physical_closure_reason_code: null,
        physical_closure_note: null,
        physical_closed_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not reopen the cafe." };
    await audit(admin, profile.id, "store.physical_opened", {});
    refresh();
    return { ok: true };
  }

  if (!parsed.data.reasonCode) {
    return { ok: false, error: "Choose a closure reason for the cafe." };
  }
  const physFields = closureFields(
    "physical_",
    parsed.data.reasonCode,
    parsed.data.note,
    parsed.data.until
  );
  if (!physFields.ok) return physFields;

  let patch: Record<string, unknown> = { ...physFields.patch };

  if (parsed.data.webstore) {
    const w = parsed.data.webstore;
    const webFields = closureFields("", w.reasonCode, w.note, w.until);
    if (!webFields.ok) return webFields;
    patch = {
      ...patch,
      ...webFields.patch,
      high_demand: false,
      high_demand_minutes: null,
      high_demand_until: null,
    };
  }

  const { error } = await admin.from("app_settings").update(patch).eq("id", 1);
  if (error) return { ok: false, error: "Could not close the cafe." };
  await audit(admin, profile.id, "store.physical_closed", patch);
  refresh();
  return { ok: true };
}

export async function setStoreOpen(): Promise<StoreActionResult> {
  return setWebstoreStatus({ open: true });
}

export async function setStoreClosed(input: {
  reasonCode: ClosureReasonCode;
  note?: string;
  until?: string | null;
}): Promise<StoreActionResult> {
  return setWebstoreStatus({ open: false, ...input });
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
    await audit(admin, profile.id, "store.high_demand_off", {});
    refresh();
    return { ok: true };
  }

  const current = await admin
    .from("app_settings")
    .select("accepting_orders")
    .eq("id", 1)
    .single();
  if (current.error) return { ok: false, error: "Could not update high-demand mode." };
  if (!current.data.accepting_orders) {
    return { ok: false, error: "Open the webstore before enabling high demand." };
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
  await audit(admin, profile.id, "store.high_demand_on", { minutes, until });
  refresh();
  return { ok: true };
}
