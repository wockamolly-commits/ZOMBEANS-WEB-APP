import {
  STATIC_MENU,
  type StaticCategory,
  type StaticItem,
} from "@/lib/menu-static";

export type ProductRecommendation = {
  item: StaticItem;
  categorySlug: string;
  groupSlug: string;
  reason: string;
};

type CatalogEntry = ProductRecommendation & {
  categoryName: string;
};

const CATEGORY_GROUPS: Record<string, string> = {
  "signature-drinks": "coffee-based",
  coffee: "coffee-based",
  matcha: "non-coffee-based",
  "milk-series": "non-coffee-based",
  "creamcheese-series": "non-coffee-based",
  sparkling: "non-coffee-based",
  tea: "non-coffee-based",
  "rice-bowls": "food",
  toasts: "food",
  croffles: "food",
  chicken: "food",
  sides: "food",
};

const BEVERAGE_CATEGORIES = new Set([
  "signature-drinks",
  "coffee",
  "matcha",
  "milk-series",
  "creamcheese-series",
  "sparkling",
  "tea",
]);

const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  "signature-drinks": ["croffles", "toasts", "sides", "chicken", "rice-bowls"],
  coffee: ["croffles", "toasts", "sides", "chicken", "rice-bowls"],
  matcha: ["croffles", "toasts", "sides", "chicken"],
  "milk-series": ["croffles", "sides", "chicken", "toasts"],
  "creamcheese-series": ["croffles", "sides", "chicken", "toasts"],
  sparkling: ["chicken", "sides", "rice-bowls", "toasts"],
  tea: ["croffles", "toasts", "rice-bowls", "chicken"],
  "rice-bowls": ["tea", "sparkling", "signature-drinks", "matcha"],
  toasts: ["signature-drinks", "coffee", "tea", "sparkling"],
  croffles: ["signature-drinks", "coffee", "matcha", "tea"],
  chicken: ["sparkling", "tea", "signature-drinks", "milk-series"],
  sides: ["sparkling", "tea", "signature-drinks", "matcha"],
};

// Curated from natural menu pairings. This can be augmented with real
// order-item co-purchase counts once enough order history is available.
const FREQUENT_PAIRINGS: Record<string, string[]> = {
  "zomboss-drink": ["plain-croffles", "bacon-toast", "chick-n-chips"],
  "spanish-latte": ["biscoff-croffles", "bacon-toast", "flavored-fries"],
  "salted-caramel-latte": ["choco-almond-croffles", "salami-toast"],
  "biscoff-latte": ["plain-croffles", "chick-n-buns"],
  americano: ["biscoff-croffles", "bacon-toast", "chick-n-fries"],
  "matcha-latte": ["plain-croffles", "chicken-ham-overload-sandwich"],
  "ube-milk": ["chick-n-chips", "plain-croffles"],
  "honey-lemon-tea": ["bacon-toast", "burger-steak"],
  "bacon-bowl": ["honey-lemon-tea", "sparkling-strawberry"],
  "burger-steak": ["honey-lemon-pomegranate-tea", "zomboss-drink"],
  "bacon-toast": ["spanish-latte", "matcha-latte"],
  "biscoff-croffles": ["americano", "spanish-latte"],
  "choco-almond-croffles": ["salted-caramel-latte", "matcha-latte"],
  "chick-n-fries": ["sparkling-strawberry", "honey-lemon-tea"],
  "chick-n-buns": ["sparkling-blueberry", "spanish-latte"],
  "nachos-overload": ["sparkling-strawberry", "honey-lemon-pomegranate-tea"],
};

const CATALOG: CatalogEntry[] = STATIC_MENU.flatMap((category) =>
  category.items.map((item) => ({
    item,
    categorySlug: category.slug,
    categoryName: category.name,
    groupSlug: CATEGORY_GROUPS[category.slug] ?? "best-sellers",
    reason: "",
  }))
);

function findCategory(slug: string): StaticCategory | undefined {
  return STATIC_MENU.find((category) => category.slug === slug);
}

function isBeverage(categorySlug: string) {
  return BEVERAGE_CATEGORIES.has(categorySlug);
}

function pairingReason(
  candidate: CatalogEntry,
  currentEntries: CatalogEntry[],
  isFrequentPair: boolean
) {
  if (isFrequentPair) return "Frequently paired";

  const complementsFood = currentEntries.some((entry) => isBeverage(entry.categorySlug));
  if (complementsFood && candidate.categorySlug === "croffles") return "Sweet pairing";
  if (complementsFood) return "Great with your drink";
  if (isBeverage(candidate.categorySlug)) return "Drink pairing";
  if (candidate.item.isBestseller) return "Popular pick";
  return `Try something from ${candidate.categoryName}`;
}

/**
 * Produces a complementary, category-balanced list for one item or a cart.
 * Same-category products are strongly penalized and only used as a last resort.
 */
export function getProductRecommendations(
  currentItemSlugs: string[],
  limit = 4
): ProductRecommendation[] {
  if (limit <= 0) return [];

  const currentSlugSet = new Set(currentItemSlugs);
  const currentEntries = CATALOG.filter((entry) =>
    currentSlugSet.has(entry.item.slug)
  );
  const currentCategorySet = new Set(
    currentEntries.map((entry) => entry.categorySlug)
  );

  const ranked = CATALOG.filter((entry) => !currentSlugSet.has(entry.item.slug))
    .map((candidate, catalogIndex) => {
      let score = candidate.item.isBestseller ? 18 : 0;
      let isFrequentPair = false;

      for (const current of currentEntries) {
        const pairing = FREQUENT_PAIRINGS[current.item.slug] ?? [];
        if (pairing.includes(candidate.item.slug)) {
          score += 140;
          isFrequentPair = true;
        }

        const complementary =
          COMPLEMENTARY_CATEGORIES[current.categorySlug] ?? [];
        const complementaryIndex = complementary.indexOf(candidate.categorySlug);
        if (complementaryIndex >= 0) score += 90 - complementaryIndex * 8;

        if (candidate.categorySlug === current.categorySlug) {
          score -= 160;
        } else if (
          isBeverage(candidate.categorySlug) ===
          isBeverage(current.categorySlug)
        ) {
          score -= 28;
        } else {
          score += 24;
        }
      }

      if (currentCategorySet.has(candidate.categorySlug)) score -= 60;

      return {
        ...candidate,
        reason: pairingReason(candidate, currentEntries, isFrequentPair),
        score,
        catalogIndex,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(Boolean(b.item.isBestseller)) -
          Number(Boolean(a.item.isBestseller)) ||
        a.catalogIndex - b.catalogIndex
    );

  const selected: typeof ranked = [];
  const usedCategories = new Set<string>();

  // First pass: one recommendation per category for visible variety.
  for (const candidate of ranked) {
    if (usedCategories.has(candidate.categorySlug)) continue;
    selected.push(candidate);
    usedCategories.add(candidate.categorySlug);
    if (selected.length === limit) break;
  }

  // Small menus may not have enough categories, so fill without duplicates.
  if (selected.length < limit) {
    const selectedSlugs = new Set(selected.map((entry) => entry.item.slug));
    for (const candidate of ranked) {
      if (selectedSlugs.has(candidate.item.slug)) continue;
      selected.push(candidate);
      if (selected.length === limit) break;
    }
  }

  return selected.map(({ item, categorySlug, groupSlug, reason }) => ({
    item,
    categorySlug,
    groupSlug,
    reason,
  }));
}

export function getRecommendationCategoryName(categorySlug: string) {
  return findCategory(categorySlug)?.name ?? "Menu";
}
