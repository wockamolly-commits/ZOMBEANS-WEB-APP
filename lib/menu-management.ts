import "server-only";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import type {
  ManagedCategory,
  ManagedMenuItem,
  ManagedOptionGroup,
  MenuManagementData,
} from "@/lib/menu-management-types";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type ItemRow = Omit<ManagedMenuItem, "variations" | "option_links">;

export async function getMenuManagementData(): Promise<MenuManagementData> {
  const admin = await createAdminSessionClient();
  await admin.rpc("refresh_expired_menu_item_availability");
  const [
    categoriesResult,
    itemsResult,
    variationsResult,
    groupsResult,
    optionsResult,
    linksResult,
  ] = await Promise.all([
    admin
      .from("menu_categories")
      .select("id, slug, name, is_active, sort_order")
      .order("sort_order")
      .order("name"),
    admin
      .from("menu_items")
      .select(
        "id, category_id, slug, name, description, image_url, is_bestseller, is_active, unavailability_kind, unavailable_until, sort_order"
      )
      .order("sort_order")
      .order("name"),
    admin
      .from("item_variations")
      .select(
        "id, item_id, label, price_cents, is_default, is_active, sort_order"
      )
      .order("sort_order"),
    admin
      .from("menu_option_groups")
      .select("id, name, description, is_active, sort_order")
      .order("sort_order")
      .order("name"),
    admin
      .from("menu_options")
      .select(
        "id, group_id, name, price_delta_cents, is_active, sort_order"
      )
      .order("sort_order"),
    admin
      .from("menu_item_option_groups")
      .select(
        "item_id, group_id, is_required, min_select, max_select, sort_order"
      )
      .order("sort_order"),
  ]);

  const error =
    categoriesResult.error ??
    itemsResult.error ??
    variationsResult.error ??
    groupsResult.error ??
    optionsResult.error ??
    linksResult.error;
  if (error) throw new Error(`Could not load menu management data: ${error.message}`);

  const variationsByItem = new Map<string, ManagedMenuItem["variations"]>();
  for (const row of variationsResult.data ?? []) {
    const current = variationsByItem.get(row.item_id) ?? [];
    current.push({
      id: row.id,
      label: row.label,
      price_cents: Number(row.price_cents),
      is_default: row.is_default,
      is_active: row.is_active,
      sort_order: row.sort_order,
    });
    variationsByItem.set(row.item_id, current);
  }

  const linksByItem = new Map<string, ManagedMenuItem["option_links"]>();
  const linkedItemsByGroup = new Map<string, string[]>();
  for (const row of linksResult.data ?? []) {
    const itemLinks = linksByItem.get(row.item_id) ?? [];
    itemLinks.push({
      group_id: row.group_id,
      is_required: row.is_required,
      min_select: row.min_select,
      max_select: row.max_select,
      sort_order: row.sort_order,
    });
    linksByItem.set(row.item_id, itemLinks);

    const groupItems = linkedItemsByGroup.get(row.group_id) ?? [];
    groupItems.push(row.item_id);
    linkedItemsByGroup.set(row.group_id, groupItems);
  }

  const itemsByCategory = new Map<string, ManagedMenuItem[]>();
  for (const row of (itemsResult.data ?? []) as ItemRow[]) {
    const current = itemsByCategory.get(row.category_id) ?? [];
    current.push({
      ...row,
      variations: variationsByItem.get(row.id) ?? [],
      option_links: linksByItem.get(row.id) ?? [],
    });
    itemsByCategory.set(row.category_id, current);
  }

  const categories: ManagedCategory[] = (
    (categoriesResult.data ?? []) as CategoryRow[]
  ).map((category) => ({
    ...category,
    items: itemsByCategory.get(category.id) ?? [],
  }));

  const optionsByGroup = new Map<string, ManagedOptionGroup["options"]>();
  for (const row of optionsResult.data ?? []) {
    const current = optionsByGroup.get(row.group_id) ?? [];
    current.push({
      id: row.id,
      group_id: row.group_id,
      name: row.name,
      price_delta_cents: Number(row.price_delta_cents),
      is_active: row.is_active,
      sort_order: row.sort_order,
    });
    optionsByGroup.set(row.group_id, current);
  }

  const optionGroups: ManagedOptionGroup[] = (groupsResult.data ?? []).map(
    (group) => ({
      ...group,
      options: optionsByGroup.get(group.id) ?? [],
      linked_item_ids: linkedItemsByGroup.get(group.id) ?? [],
    })
  );

  return { categories, optionGroups };
}
