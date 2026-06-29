import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  MENU_GROUPS,
  STATIC_MENU,
  type MenuGroup,
  type StaticCategory,
  type StaticItem,
  type StaticVariation,
} from "@/lib/menu-static";

const FALLBACK_PRODUCT_IMAGE = "/images/brand/zombeans-logo.png";
const FALLBACK_PATTERN_IMAGE = "/images/brand/patterns/food.svg";

type CategoryRow = {
  slug: string;
  name: string;
  sort_order: number;
};

type ItemRow = {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_bestseller: boolean;
  sort_order: number;
};

type StorefrontMenuRow = {
  category_slug: string;
  category_name: string;
  category_sort_order: number;
  item_slug: string;
  item_name: string;
  item_description: string | null;
  item_image_url: string | null;
  item_is_bestseller: boolean;
  item_sort_order: number;
  variation_label: string;
  variation_price_cents: number | string;
  variation_is_default: boolean;
  variation_sort_order: number;
};

export type StorefrontMenuModel = {
  categories: StaticCategory[];
  groups: MenuGroup[];
};

function toVariation(row: StorefrontMenuRow): StaticVariation {
  return {
    label: row.variation_label,
    priceCents: Number(row.variation_price_cents),
    isDefault: row.variation_is_default,
  };
}

function toItem(row: ItemRow, variations: StaticVariation[]): StaticItem {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    image: row.image_url || FALLBACK_PRODUCT_IMAGE,
    isBestseller: row.is_bestseller,
    variations,
  };
}

function buildDynamicCategoryGroups(categories: StaticCategory[]): MenuGroup[] {
  const groupedCategorySlugs = new Set(
    MENU_GROUPS.flatMap((group) => group.categorySlugs ?? [])
  );

  return categories
    .filter((category) => !groupedCategorySlugs.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      blurb:
        category.items.length === 1
          ? "1 menu item"
          : `${category.items.length} menu items`,
      kind: "Menu",
      categorySlugs: [category.slug],
      previewImage: category.items[0]?.image ?? FALLBACK_PRODUCT_IMAGE,
      patternImage: FALLBACK_PATTERN_IMAGE,
    }));
}

function isMissingStorefrontMenuRpc(message: string): boolean {
  return (
    message.includes("get_storefront_menu") &&
    message.includes("schema cache")
  );
}

function buildMenuModelFromRows(rows: StorefrontMenuRow[]): StorefrontMenuModel {
  if (!rows.length) {
    return { categories: [], groups: MENU_GROUPS };
  }

  const categoryRows = new Map<string, CategoryRow>();
  const itemRows = new Map<string, ItemRow>();
  const itemSlugsByCategory = new Map<string, string[]>();
  const variationsByItem = new Map<string, StaticVariation[]>();

  for (const row of rows) {
    if (!categoryRows.has(row.category_slug)) {
      categoryRows.set(row.category_slug, {
        slug: row.category_slug,
        name: row.category_name,
        sort_order: row.category_sort_order,
      });
    }

    if (!itemRows.has(row.item_slug)) {
      itemRows.set(row.item_slug, {
        slug: row.item_slug,
        name: row.item_name,
        description: row.item_description,
        image_url: row.item_image_url,
        is_bestseller: row.item_is_bestseller,
        sort_order: row.item_sort_order,
      });

      const categoryItems = itemSlugsByCategory.get(row.category_slug) ?? [];
      categoryItems.push(row.item_slug);
      itemSlugsByCategory.set(row.category_slug, categoryItems);
    }

    const current = variationsByItem.get(row.item_slug) ?? [];
    current.push(toVariation(row));
    variationsByItem.set(row.item_slug, current);
  }

  const categories = [...categoryRows.values()].map((category) => ({
    slug: category.slug,
    name: category.name,
    items: (itemSlugsByCategory.get(category.slug) ?? []).flatMap((slug) => {
      const item = itemRows.get(slug);
      const variations = variationsByItem.get(slug) ?? [];
      return item && variations.length ? [toItem(item, variations)] : [];
    }),
  }));

  return {
    categories,
    groups: [...MENU_GROUPS, ...buildDynamicCategoryGroups(categories)],
  };
}

async function getStorefrontMenuFromTables(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<StorefrontMenuModel | null> {
  const categoriesResult = await supabase
    .from("menu_categories")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (categoriesResult.error) return null;

  const categoryRows = categoriesResult.data ?? [];
  const categoryIds = categoryRows.map((category) => category.id);
  if (!categoryIds.length) return { categories: [], groups: MENU_GROUPS };

  const itemsResult = await supabase
    .from("menu_items")
    .select(
      "id, category_id, slug, name, description, image_url, is_bestseller"
    )
    .in("category_id", categoryIds)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (itemsResult.error) return null;

  const itemRows = itemsResult.data ?? [];
  const itemIds = itemRows.map((item) => item.id);
  if (!itemIds.length) {
    return {
      categories: categoryRows.map((category) => ({
        slug: category.slug,
        name: category.name,
        items: [],
      })),
      groups: MENU_GROUPS,
    };
  }

  const variationsResult = await supabase
    .from("item_variations")
    .select("item_id, label, price_cents, is_default")
    .in("item_id", itemIds)
    .eq("is_active", true)
    .order("sort_order");
  if (variationsResult.error) return null;

  const itemById = new Map(itemRows.map((item) => [item.id, item]));
  const rows: StorefrontMenuRow[] = [];
  for (const variation of variationsResult.data ?? []) {
    const item = itemById.get(variation.item_id);
    const category = item
      ? categoryRows.find((entry) => entry.id === item.category_id)
      : null;
    if (!item || !category) continue;

    rows.push({
      category_slug: category.slug,
      category_name: category.name,
      category_sort_order: 0,
      item_slug: item.slug,
      item_name: item.name,
      item_description: item.description,
      item_image_url: item.image_url,
      item_is_bestseller: item.is_bestseller,
      item_sort_order: 0,
      variation_label: variation.label,
      variation_price_cents: variation.price_cents,
      variation_is_default: variation.is_default,
      variation_sort_order: 0,
    });
  }

  return buildMenuModelFromRows(rows);
}

export async function getStorefrontMenuModel(): Promise<StorefrontMenuModel> {
  const supabase = await createClient();
  const result = await supabase.rpc("get_storefront_menu");

  if (!result.error) {
    return buildMenuModelFromRows((result.data ?? []) as StorefrontMenuRow[]);
  }

  if (!isMissingStorefrontMenuRpc(result.error.message)) {
    console.warn("[storefront-menu] RPC fallback:", result.error.message);
  }
  const tableModel = await getStorefrontMenuFromTables(supabase);
  if (tableModel) return tableModel;

  console.warn("[storefront-menu] using static fallback catalog");
  return { categories: STATIC_MENU, groups: MENU_GROUPS };
}

export function findStorefrontGroup(
  groups: MenuGroup[],
  slug: string
): MenuGroup | undefined {
  return groups.find((group) => group.slug === slug);
}

export function getStorefrontGroupCategories(
  group: MenuGroup,
  categories: StaticCategory[]
): StaticCategory[] {
  if (group.bestsellersOnly) return [];

  return (group.categorySlugs ?? []).flatMap((slug) => {
    const category = categories.find((entry) => entry.slug === slug);
    return category ? [category] : [];
  });
}

export function getStorefrontGroupItems(
  group: MenuGroup,
  categories: StaticCategory[]
): StaticItem[] {
  if (group.bestsellersOnly) {
    return categories
      .flatMap((category) => category.items)
      .filter((item) => item.isBestseller);
  }

  return getStorefrontGroupCategories(group, categories).flatMap(
    (category) => category.items
  );
}
