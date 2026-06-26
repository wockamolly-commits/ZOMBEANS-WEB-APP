"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireStaffPermission } from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type MenuActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const id = z.uuid();
const optionalId = z.union([id, z.literal("")]).optional();
const categorySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2).max(80),
  isActive: z.boolean().default(true),
});
const variationSchema = z.object({
  id: optionalId,
  label: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0).max(10_000_000),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});
const productSchema = z.object({
  id: optionalId,
  categoryId: id,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  isActive: z.boolean(),
  isBestseller: z.boolean(),
  variations: z.array(variationSchema).min(1).max(30),
  optionGroupIds: z.array(id).max(30),
});
const availabilityHoldSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("today"),
    unavailableUntil: z.iso.datetime(),
  }),
  z.object({
    kind: z.literal("until"),
    unavailableUntil: z.iso.datetime(),
  }),
  z.object({
    kind: z.literal("indefinite"),
    unavailableUntil: z.null().optional(),
  }),
]);
const optionGroupSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300),
  isActive: z.boolean(),
});
const optionSchema = z.object({
  id: optionalId,
  groupId: id,
  name: z.string().trim().min(1).max(100),
  priceDeltaCents: z.number().int().min(0).max(10_000_000),
  isActive: z.boolean(),
});
const linkSchema = z.object({
  groupId: id,
  itemIds: z.array(id).max(500),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function fail(error: unknown): MenuActionResult {
  console.error("[menu-management]", error);
  return { ok: false, error: "The menu change could not be saved. Try again." };
}

async function audit(
  actorId: string,
  action: string,
  table: string,
  targetId: string,
  diff?: Record<string, unknown>
) {
  const admin = await createAdminSessionClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_profile_id: actorId,
    action,
    target_table: table,
    target_id: targetId,
    diff,
  });
  if (error) console.error("[menu-management] audit log failed:", error.message);
}

function refreshMenu() {
  revalidatePath("/workspace/menu");
  revalidatePath("/menu");
}

export async function saveCategory(
  input: z.input<typeof categorySchema>
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the category details." };
  const admin = await createAdminSessionClient();
  const { id: categoryId, name, isActive } = parsed.data;
  try {
    if (categoryId) {
      const result = await admin
        .from("menu_categories")
        .update({ name, is_active: isActive })
        .eq("id", categoryId)
        .select("id")
        .single();
      if (result.error) throw result.error;
      await audit(profile.id, "menu.category.updated", "menu_categories", categoryId, {
        name,
        is_active: isActive,
      });
    } else {
      const max = await admin
        .from("menu_categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const result = await admin
        .from("menu_categories")
        .insert({
          name,
          slug: `${slugify(name)}-${randomUUID().slice(0, 6)}`,
          is_active: isActive,
          sort_order: (max.data?.sort_order ?? 0) + 10,
        })
        .select("id")
        .single();
      if (result.error) throw result.error;
      await audit(profile.id, "menu.category.created", "menu_categories", result.data.id, {
        name,
      });
    }
    refreshMenu();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveProduct(formData: FormData): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "The product form is invalid." };
  }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the product and size details." };

  const admin = await createAdminSessionClient();
  const product = parsed.data;
  try {
    let imageUrl: string | null | undefined;
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 5 * 1024 * 1024 || !image.type.startsWith("image/")) {
        return { ok: false, error: "Use a JPG, PNG, WEBP, or GIF image under 5 MB." };
      }
      const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
      const upload = await admin.storage.from("menu-images").upload(path, image, {
        contentType: image.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      imageUrl = admin.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    }

    let itemId = product.id;
    if (itemId) {
      const update = await admin
        .from("menu_items")
        .update({
          category_id: product.categoryId,
          name: product.name,
          description: product.description || null,
          is_active: product.isActive,
          ...(product.isActive
            ? { unavailability_kind: null, unavailable_until: null }
            : { unavailability_kind: "indefinite", unavailable_until: null }),
          is_bestseller: product.isBestseller,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        })
        .eq("id", itemId);
      if (update.error) throw update.error;
      await admin.from("item_variations").update({ is_active: false }).eq("item_id", itemId);
    } else {
      const max = await admin
        .from("menu_items")
        .select("sort_order")
        .eq("category_id", product.categoryId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const created = await admin
        .from("menu_items")
        .insert({
          category_id: product.categoryId,
          slug: `${slugify(product.name)}-${randomUUID().slice(0, 6)}`,
          name: product.name,
          description: product.description || null,
          image_url: imageUrl ?? null,
          is_active: product.isActive,
          unavailability_kind: product.isActive ? null : "indefinite",
          unavailable_until: null,
          is_bestseller: product.isBestseller,
          sort_order: (max.data?.sort_order ?? 0) + 10,
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      itemId = created.data.id;
    }
    if (!itemId) throw new Error("Product ID was not created.");

    const variations = product.variations.map((variation, index) => ({
      ...(variation.id ? { id: variation.id } : {}),
      item_id: itemId,
      label: variation.label,
      price_cents: variation.priceCents,
      is_default: variation.isDefault,
      is_active: variation.isActive,
      sort_order: (index + 1) * 10,
    }));
    const variationResult = await admin
      .from("item_variations")
      .upsert(variations, { onConflict: "id" });
    if (variationResult.error) throw variationResult.error;

    const unlink = await admin
      .from("menu_item_option_groups")
      .delete()
      .eq("item_id", itemId);
    if (unlink.error) throw unlink.error;
    if (product.optionGroupIds.length) {
      const link = await admin.from("menu_item_option_groups").insert(
        product.optionGroupIds.map((groupId, index) => ({
          item_id: itemId,
          group_id: groupId,
          sort_order: (index + 1) * 10,
        }))
      );
      if (link.error) throw link.error;
    }

    await audit(
      profile.id,
      product.id ? "menu.item.updated" : "menu.item.created",
      "menu_items",
      itemId,
      { name: product.name, category_id: product.categoryId }
    );
    refreshMenu();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setProductAvailability(
  itemId: string,
  active: boolean,
  hold?: z.input<typeof availabilityHoldSchema>
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:availability", "/workspace/menu");
  const parsed = id.safeParse(itemId);
  if (!parsed.success) return { ok: false, error: "Invalid product." };
  const parsedHold = active
    ? null
    : availabilityHoldSchema.safeParse(hold);
  if (!active && (!parsedHold || !parsedHold.success)) {
    return { ok: false, error: "Choose how long this product should be unavailable." };
  }

  const unavailableUntil =
    !active && parsedHold?.success && parsedHold.data.kind !== "indefinite"
      ? new Date(parsedHold.data.unavailableUntil)
      : null;
  if (unavailableUntil && unavailableUntil.getTime() <= Date.now()) {
    return { ok: false, error: "Choose a future date for the product to return." };
  }

  const admin = await createAdminSessionClient();
  const result = await admin
    .from("menu_items")
    .update({
      is_active: active,
      unavailability_kind: active
        ? null
        : parsedHold?.success
          ? parsedHold.data.kind
          : null,
      unavailable_until: active ? null : unavailableUntil?.toISOString() ?? null,
    })
    .eq("id", parsed.data);
  if (result.error) return fail(result.error);
  await audit(profile.id, "menu.item.availability_changed", "menu_items", parsed.data, {
    is_active: active,
    unavailability_kind: active
      ? null
      : parsedHold?.success
        ? parsedHold.data.kind
        : null,
    unavailable_until: active ? null : unavailableUntil?.toISOString() ?? null,
  });
  refreshMenu();
  return { ok: true };
}

export async function saveOptionGroup(
  input: z.input<typeof optionGroupSchema>
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
  const parsed = optionGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the option group details." };
  const admin = await createAdminSessionClient();
  const group = parsed.data;
  try {
    let groupId = group.id;
    if (groupId) {
      const result = await admin
        .from("menu_option_groups")
        .update({
          name: group.name,
          description: group.description || null,
          is_active: group.isActive,
        })
        .eq("id", groupId);
      if (result.error) throw result.error;
    } else {
      const max = await admin
        .from("menu_option_groups")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const result = await admin
        .from("menu_option_groups")
        .insert({
          name: group.name,
          description: group.description || null,
          is_active: group.isActive,
          sort_order: (max.data?.sort_order ?? 0) + 10,
        })
        .select("id")
        .single();
      if (result.error) throw result.error;
      groupId = result.data.id;
    }
    if (!groupId) throw new Error("Option group ID was not created.");
    await audit(
      profile.id,
      group.id ? "menu.option_group.updated" : "menu.option_group.created",
      "menu_option_groups",
      groupId,
      { name: group.name }
    );
    refreshMenu();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveOption(
  input: z.input<typeof optionSchema>
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
  const parsed = optionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the option details." };
  const admin = await createAdminSessionClient();
  const option = parsed.data;
  try {
    let optionId = option.id;
    if (optionId) {
      const result = await admin
        .from("menu_options")
        .update({
          name: option.name,
          price_delta_cents: option.priceDeltaCents,
          is_active: option.isActive,
        })
        .eq("id", optionId);
      if (result.error) throw result.error;
    } else {
      const max = await admin
        .from("menu_options")
        .select("sort_order")
        .eq("group_id", option.groupId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const result = await admin
        .from("menu_options")
        .insert({
          group_id: option.groupId,
          name: option.name,
          price_delta_cents: option.priceDeltaCents,
          is_active: option.isActive,
          sort_order: (max.data?.sort_order ?? 0) + 10,
        })
        .select("id")
        .single();
      if (result.error) throw result.error;
      optionId = result.data.id;
    }
    if (!optionId) throw new Error("Option ID was not created.");
    await audit(
      profile.id,
      option.id ? "menu.option.updated" : "menu.option.created",
      "menu_options",
      optionId,
      { name: option.name, price_delta_cents: option.priceDeltaCents }
    );
    refreshMenu();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setOptionAvailability(
  optionId: string,
  active: boolean
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:availability", "/workspace/menu");
  const parsed = id.safeParse(optionId);
  if (!parsed.success) return { ok: false, error: "Invalid option." };
  const admin = await createAdminSessionClient();
  const result = await admin
    .from("menu_options")
    .update({ is_active: active })
    .eq("id", parsed.data);
  if (result.error) return fail(result.error);
  await audit(profile.id, "menu.option.availability_changed", "menu_options", parsed.data, {
    is_active: active,
  });
  refreshMenu();
  return { ok: true };
}

export async function linkOptionGroup(
  input: z.input<typeof linkSchema>
): Promise<MenuActionResult> {
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the selected products." };
  const admin = await createAdminSessionClient();
  const { groupId, itemIds } = parsed.data;
  try {
    const removed = await admin
      .from("menu_item_option_groups")
      .delete()
      .eq("group_id", groupId);
    if (removed.error) throw removed.error;
    if (itemIds.length) {
      const linked = await admin.from("menu_item_option_groups").insert(
        itemIds.map((itemId, index) => ({
          group_id: groupId,
          item_id: itemId,
          sort_order: (index + 1) * 10,
        }))
      );
      if (linked.error) throw linked.error;
    }
    await audit(
      profile.id,
      "menu.option_group.products_linked",
      "menu_option_groups",
      groupId,
      { item_ids: itemIds }
    );
    refreshMenu();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
