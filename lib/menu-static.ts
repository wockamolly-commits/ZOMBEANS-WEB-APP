/**
 * Local mirror of seed data for static rendering in Phase 0.
 * Once Supabase is deployed, swap callers to fetch from the DB.
 *
 * Prices are in centavos.
 */

export type StaticVariation = {
  label: string;
  priceCents: number;
  isDefault?: boolean;
};

export type StaticItem = {
  slug: string;
  name: string;
  description: string;
  image: string;
  isBestseller?: boolean;
  variations: StaticVariation[];
};

export type StaticCategory = {
  slug: string;
  name: string;
  items: StaticItem[];
};

export const STATIC_MENU: StaticCategory[] = [
  {
    slug: "signature-drinks",
    name: "Signature Drinks",
    items: [
      {
        slug: "zomboss-drink",
        name: "Zomboss Drink",
        description:
          "House signature. Espresso, milk, and the secret syrup we don't talk about.",
        image: "/images/drinks/zomboss-latte.png",
        isBestseller: true,
        variations: [
          { label: "Cold 16oz", priceCents: 11000, isDefault: true },
          { label: "Cold 1L", priceCents: 21500 },
        ],
      },
      {
        slug: "spanish-latte",
        name: "Spanish Latte",
        description:
          "Espresso pulled long, condensed milk for that classic Spanish sweetness.",
        image: "/images/drinks/spanish-latte.png",
        isBestseller: true,
        variations: [
          { label: "Hot", priceCents: 10000 },
          { label: "Cold 16oz", priceCents: 10000, isDefault: true },
          { label: "Cold 1L", priceCents: 19500 },
        ],
      },
      {
        slug: "salted-caramel-latte",
        name: "Salted Caramel Latte",
        description: "Caramel, espresso, sea salt finish.",
        image: "/images/drinks/salted-caramel-latte.png",
        isBestseller: true,
        variations: [
          { label: "Cold 16oz", priceCents: 10500, isDefault: true },
          { label: "Cold 1L", priceCents: 20500 },
        ],
      },
      {
        slug: "biscoff-latte",
        name: "Biscoff Latte",
        description: "Iced latte layered with Biscoff cream and a real Biscoff cookie.",
        image: "/images/drinks/biscoff-latte.png",
        isBestseller: true,
        variations: [
          { label: "Cold 16oz", priceCents: 12500, isDefault: true },
          { label: "Cold 1L", priceCents: 24500 },
        ],
      },
    ],
  },
  {
    slug: "matcha",
    name: "Matcha",
    items: [
      {
        slug: "matcha-latte",
        name: "Matcha Latte",
        description: "Ceremonial-grade matcha, whisked the slow way.",
        image: "/images/drinks/matcha-latte.png",
        isBestseller: true,
        variations: [
          { label: "Hot", priceCents: 11000 },
          { label: "Cold 16oz", priceCents: 11000, isDefault: true },
          { label: "Cold 1L", priceCents: 21500 },
        ],
      },
    ],
  },
  {
    slug: "rice-bowls",
    name: "Rice Bowls",
    items: [
      {
        slug: "bacon-bowl",
        name: "Bacon Bowl",
        description: "Bacon, egg, garlic rice, lettuce.",
        image: "/images/food/bacon-bowl.png",
        isBestseller: true,
        variations: [{ label: "Regular", priceCents: 14500, isDefault: true }],
      },
      {
        slug: "burger-steak",
        name: "Burger Steak",
        description: "Beef burger steak, rice, egg, mushroom gravy.",
        image: "/images/food/burger-steak.png",
        isBestseller: true,
        variations: [{ label: "Regular", priceCents: 15000, isDefault: true }],
      },
    ],
  },
  {
    slug: "croffles",
    name: "Croffles",
    items: [
      {
        slug: "choco-almond-croffles",
        name: "Choco Almond Croffles",
        description: "Croffle with chocolate sauce and toasted almonds.",
        image: "/images/food/choco-almond-croffles.png",
        isBestseller: true,
        variations: [{ label: "Regular", priceCents: 11000, isDefault: true }],
      },
    ],
  },
];

export function getBestsellers(limit = 6): StaticItem[] {
  const out: StaticItem[] = [];
  for (const cat of STATIC_MENU) {
    for (const item of cat.items) {
      if (item.isBestseller) out.push(item);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function getDefaultPriceCents(item: StaticItem): number {
  const def = item.variations.find((v) => v.isDefault) ?? item.variations[0];
  return def.priceCents;
}
