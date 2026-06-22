import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StorefrontOption = {
  id: string;
  name: string;
  priceDeltaCents: number;
};

export type StorefrontOptionGroup = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: StorefrontOption[];
};

export async function getStorefrontOptionGroups(
  itemSlug: string
): Promise<StorefrontOptionGroup[]> {
  const supabase = await createClient();
  const itemResult = await supabase
    .from("menu_items")
    .select("id")
    .eq("slug", itemSlug)
    .maybeSingle();
  if (itemResult.error || !itemResult.data) return [];

  const linksResult = await supabase
    .from("menu_item_option_groups")
    .select("group_id, is_required, min_select, max_select, sort_order")
    .eq("item_id", itemResult.data.id)
    .order("sort_order");
  if (linksResult.error || !linksResult.data?.length) return [];

  const groupIds = linksResult.data.map((link) => link.group_id);
  const [groupsResult, optionsResult] = await Promise.all([
    supabase
      .from("menu_option_groups")
      .select("id, name, description, sort_order")
      .in("id", groupIds)
      .order("sort_order"),
    supabase
      .from("menu_options")
      .select("id, group_id, name, price_delta_cents, sort_order")
      .in("group_id", groupIds)
      .order("sort_order"),
  ]);
  if (groupsResult.error || optionsResult.error) return [];

  const groupById = new Map(
    (groupsResult.data ?? []).map((group) => [group.id, group])
  );
  const optionsByGroup = new Map<string, StorefrontOption[]>();
  for (const option of optionsResult.data ?? []) {
    const current = optionsByGroup.get(option.group_id) ?? [];
    current.push({
      id: option.id,
      name: option.name,
      priceDeltaCents: Number(option.price_delta_cents),
    });
    optionsByGroup.set(option.group_id, current);
  }

  return linksResult.data.flatMap((link) => {
    const group = groupById.get(link.group_id);
    const options = optionsByGroup.get(link.group_id) ?? [];
    if (!group || options.length === 0) return [];
    return [
      {
        id: group.id,
        name: group.name,
        description: group.description,
        isRequired: link.is_required,
        minSelect: link.min_select,
        maxSelect: link.max_select,
        options,
      },
    ];
  });
}
