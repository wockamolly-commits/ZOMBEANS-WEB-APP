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

// helpers — keep declarations terse
const hot = (c: number, def = false): StaticVariation => ({ label: "Hot", priceCents: c, isDefault: def });
const cold16 = (c: number, def = true): StaticVariation => ({ label: "Cold 16oz", priceCents: c, isDefault: def });
const cold1L = (c: number): StaticVariation => ({ label: "Cold 1L", priceCents: c });
const cold = (c: number, def = true): StaticVariation => ({ label: "Cold", priceCents: c, isDefault: def });
const reg = (c: number): StaticVariation => ({ label: "Regular", priceCents: c, isDefault: true });

export const STATIC_MENU: StaticCategory[] = [
  {
    slug: "signature-drinks",
    name: "Signature Drinks",
    items: [
      {
        slug: "zomboss-drink",
        name: "Zomboss Drink",
        description: "House signature. Espresso, milk, and the secret syrup we don't talk about.",
        image: "/images/menu/drinks/zomboss-latte.png",
        isBestseller: true,
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "spanish-latte",
        name: "Spanish Latte",
        description: "Espresso pulled long, condensed milk for that classic Spanish sweetness.",
        image: "/images/menu/drinks/spanish-latte.png",
        isBestseller: true,
        variations: [hot(10000), cold16(10000), cold1L(19500)],
      },
      {
        slug: "salted-caramel-latte",
        name: "Salted Caramel Latte",
        description: "Caramel, espresso, sea salt finish.",
        image: "/images/menu/drinks/salted-caramel-latte.png",
        isBestseller: true,
        variations: [cold16(10500), cold1L(20500)],
      },
      {
        slug: "salted-latte",
        name: "Salted Latte",
        description: "Espresso and milk with a pinch of salt — clean, balanced, addictive.",
        image: "/images/menu/drinks/salted-latte.png",
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "biscoff-latte",
        name: "Biscoff Latte",
        description: "Iced latte layered with Biscoff cream and a real Biscoff cookie.",
        image: "/images/menu/drinks/biscoff-latte.png",
        isBestseller: true,
        variations: [cold16(12500), cold1L(24500)],
      },
    ],
  },
  {
    slug: "coffee",
    name: "Coffee",
    items: [
      {
        slug: "americano",
        name: "Americano",
        description: "Two shots, hot or over ice. The honest one.",
        image: "/images/menu/drinks/iced-americano.png",
        variations: [hot(6000), cold16(7000), cold1L(13500)],
      },
      {
        slug: "caramel-latte",
        name: "Caramel Latte",
        description: "Latte sweetened with house caramel.",
        image: "/images/menu/drinks/caramel-latte.png",
        variations: [cold16(10500), cold1L(20500)],
      },
      {
        slug: "hazelnut-latte",
        name: "Hazelnut Latte",
        description: "Nutty, smooth, all-day drinkable.",
        image: "/images/menu/drinks/hazelnut-latte.png",
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "salted-hazelnut-latte",
        name: "Salted Hazelnut Latte",
        description: "Hazelnut with that signature salt finish.",
        image: "/images/menu/drinks/salted-hazelnut-latte.png",
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "mocha-latte",
        name: "Mocha Latte",
        description: "Espresso, milk, dark chocolate.",
        image: "/images/menu/drinks/mocha-latte.png",
        variations: [cold16(10500), cold1L(21500)],
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
        image: "/images/menu/drinks/matcha-latte.png",
        isBestseller: true,
        variations: [hot(11000), cold16(11000), cold1L(21500)],
      },
      {
        slug: "clean-matcha",
        name: "Clean Matcha",
        description: "Matcha and water — no sweetener, no dairy.",
        image: "/images/menu/drinks/clean-matcha.png",
        variations: [hot(10000), { label: "Cold 1L", priceCents: 19500, isDefault: true }],
      },
      {
        slug: "white-mocha-matcha",
        name: "White Mocha Matcha",
        description: "Matcha latte layered with white chocolate.",
        image: "/images/menu/drinks/white-mocha-matcha.png",
        variations: [cold16(11500), cold1L(22500)],
      },
      {
        slug: "chabako-matcha",
        name: "Chabako Matcha",
        description: "Premium reserve matcha for matcha purists.",
        image: "/images/menu/drinks/chabako-matcha.png",
        variations: [cold16(17000), cold1L(33500)],
      },
      {
        slug: "creamcheese-latte",
        name: "Creamcheese Latte",
        description: "Espresso latte topped with whipped creamcheese.",
        image: "/images/menu/drinks/creamcheese-latte.png",
        variations: [cold16(11500), cold1L(22500)],
      },
    ],
  },
  {
    slug: "milk-series",
    name: "Milk Series",
    items: [
      {
        slug: "strawberry-milk",
        name: "Strawberry Milk",
        description: "Fresh strawberry, milk, ice.",
        image: "/images/menu/drinks/strawberry-milk.png",
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "blueberry-milk",
        name: "Blueberry Milk",
        description: "Blueberry compote layered with cold milk.",
        image: "/images/menu/drinks/blueberry-milk.png",
        variations: [cold16(11000), cold1L(21500)],
      },
      {
        slug: "ube-milk",
        name: "Ube Milk",
        description: "Purple ube, milk, ice. Pinoy comfort drink.",
        image: "/images/menu/drinks/ube-milk.png",
        isBestseller: true,
        variations: [cold16(10500), cold1L(20500)],
      },
      {
        slug: "mango-milk",
        name: "Mango Milk",
        description: "Mango puree and cold milk.",
        image: "/images/menu/drinks/mango-milk.png",
        variations: [cold16(10500), cold1L(20500)],
      },
      {
        slug: "milo-overload",
        name: "Milo Overload",
        description: "Cold milk, double Milo, more Milo on top.",
        image: "/images/menu/drinks/milo-overload.png",
        variations: [cold16(10500), cold1L(20500)],
      },
      {
        slug: "choco-hq-blend",
        name: "Choco HQ Blend",
        description: "Rich chocolate blend, hot or cold.",
        image: "/images/menu/drinks/choco-hq.png",
        variations: [hot(10500), cold16(10500), cold1L(20500)],
      },
    ],
  },
  {
    slug: "creamcheese-series",
    name: "Creamcheese Series",
    items: [
      {
        slug: "strawberry-creamcheese",
        name: "Strawberry Creamcheese",
        description: "Strawberry milk topped with whipped creamcheese.",
        image: "/images/menu/drinks/strawberry-creamcheese.png",
        variations: [cold16(11500), cold1L(22500)],
      },
      {
        slug: "blueberry-creamcheese",
        name: "Blueberry Creamcheese",
        description: "Blueberry milk topped with whipped creamcheese.",
        image: "/images/menu/drinks/blueberry-creamcheese.png",
        variations: [cold16(11500), cold1L(22500)],
      },
      {
        slug: "milo-creamcheese",
        name: "Milo Creamcheese",
        description: "Milo Overload with a thick creamcheese cap.",
        image: "/images/menu/drinks/milo-creamcheese.png",
        variations: [cold16(11500), cold1L(22500)],
      },
    ],
  },
  {
    slug: "sparkling",
    name: "Sparkling",
    items: [
      {
        slug: "sparkling-strawberry",
        name: "Sparkling Strawberry",
        description: "Strawberry over sparkling water. Light and crisp.",
        image: "/images/menu/drinks/sparkling-strawberry.png",
        variations: [cold16(8000), cold1L(15500)],
      },
      {
        slug: "sparkling-blueberry",
        name: "Sparkling Blueberry",
        description: "Blueberry over sparkling water.",
        image: "/images/menu/drinks/sparkling-blueberry.png",
        variations: [cold16(8000), cold1L(15500)],
      },
    ],
  },
  {
    slug: "tea",
    name: "Tea",
    items: [
      {
        slug: "honey-lemon-tea",
        name: "Honey Lemon Tea",
        description: "Honey, lemon, hot or iced.",
        image: "/images/menu/drinks/honey-lemon-tea.png",
        isBestseller: true,
        variations: [hot(7000), cold(8000)],
      },
      {
        slug: "honey-lemon-pomegranate-tea",
        name: "Honey Lemon Pomegranate Tea",
        description: "Honey, lemon, pomegranate.",
        image: "/images/menu/drinks/honey-lemon-pomegranate.png",
        isBestseller: true,
        variations: [hot(7000), cold(8000)],
      },
      {
        slug: "honey-lemon-ginger-tea",
        name: "Honey Lemon Ginger Tea",
        description: "Honey, lemon, ginger — for when you need a reset.",
        image: "/images/menu/drinks/honey-lemon-ginger.png",
        variations: [hot(7000), cold(8000)],
      },
      {
        slug: "peach-oolong-tea",
        name: "Peach Oolong Tea",
        description: "Oolong steeped with fresh peach.",
        image: "/images/menu/drinks/peach-oolong-tea.png",
        variations: [hot(7000), cold(8000)],
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
        image: "/images/menu/food/bacon-bowl.png",
        isBestseller: true,
        variations: [reg(14500)],
      },
      {
        slug: "hungarian-bowl",
        name: "Hungarian Bowl",
        description: "Hungarian sausage, egg, garlic rice, lettuce.",
        image: "/images/menu/food/hungarian-bowl.png",
        isBestseller: true,
        variations: [reg(13500)],
      },
      {
        slug: "tocino-bowl",
        name: "Tocino Bowl",
        description: "Chicken tocino, egg, garlic rice, lettuce.",
        image: "/images/menu/food/tocino-bowl.png",
        isBestseller: true,
        variations: [reg(13500)],
      },
      {
        slug: "tapa-bowl",
        name: "Tapa Bowl",
        description: "Beef tapa, egg, garlic rice, lettuce.",
        image: "/images/menu/food/tapa-bowl.png",
        variations: [reg(13500)],
      },
      {
        slug: "corned-beef-bowl",
        name: "Corned Beef Bowl",
        description: "Corned beef, egg, garlic rice, lettuce.",
        image: "/images/menu/food/corned-beef-bowl.png",
        variations: [reg(14500)],
      },
      {
        slug: "longganisa-bowl",
        name: "Longganisa Bowl",
        description: "Longganisa, egg, garlic rice, lettuce.",
        image: "/images/menu/food/longganisa-bowl.png",
        variations: [reg(12500)],
      },
      {
        slug: "chick-n-rice",
        name: "Chick'n Rice",
        description: "Crispy chicken fillet, garlic rice, egg.",
        image: "/images/menu/food/chick-n-rice.png",
        variations: [reg(16500)],
      },
      {
        slug: "burger-steak",
        name: "Burger Steak",
        description: "Beef burger steak, rice, egg, mushroom gravy.",
        image: "/images/menu/food/burger-steak.png",
        isBestseller: true,
        variations: [reg(15000)],
      },
      {
        slug: "pork-belly-mushroom-gravy",
        name: "Pork Belly with Mushroom Gravy",
        description: "Breaded pork belly, rice, mushroom gravy.",
        image: "/images/menu/food/breaded-pork-belly.png",
        variations: [reg(15000)],
      },
    ],
  },
  {
    slug: "toasts",
    name: "Toasts",
    items: [
      {
        slug: "bacon-toast",
        name: "Bacon Toast",
        description: "Bacon, egg, wheat bread, lettuce, cheese, side dish.",
        image: "/images/menu/food/bacon-toast.png",
        isBestseller: true,
        variations: [reg(12500)],
      },
      {
        slug: "salami-toast",
        name: "Salami Toast",
        description: "Salami, egg, wheat bread, lettuce, cheese, side dish.",
        image: "/images/menu/food/salami-toast.png",
        variations: [reg(12500)],
      },
    ],
  },
  {
    slug: "croffles",
    name: "Croffles",
    items: [
      {
        slug: "plain-croffles",
        name: "Plain Croffles",
        description: "Plain croffle, butter, syrup on the side.",
        image: "/images/menu/food/plain-croffles.png",
        variations: [reg(9000)],
      },
      {
        slug: "biscoff-croffles",
        name: "Biscoff Croffles",
        description: "Croffle topped with Biscoff spread and crumbs.",
        image: "/images/menu/food/biscoff-croffles.png",
        variations: [reg(12000)],
      },
      {
        slug: "choco-almond-croffles",
        name: "Choco Almond Croffles",
        description: "Croffle with chocolate sauce and toasted almonds.",
        image: "/images/menu/food/choco-almond-croffles.png",
        isBestseller: true,
        variations: [reg(11000)],
      },
      {
        slug: "strawberry-creamcheese-croffles",
        name: "Strawberry Creamcheese Croffles",
        description: "Croffle topped with strawberry and creamcheese.",
        image: "/images/menu/food/strawberry-creamcheese-croffles.png",
        variations: [reg(13000)],
      },
      {
        slug: "blueberry-creamcheese-croffles",
        name: "Blueberry Creamcheese Croffles",
        description: "Croffle topped with blueberry and creamcheese.",
        image: "/images/menu/food/blueberry-creamcheese-croffles.png",
        variations: [reg(13000)],
      },
      {
        slug: "milo-overload-croffles",
        name: "Milo Overload Croffles",
        description: "Croffle drowned in chocolate sauce and Milo powder.",
        image: "/images/menu/food/milo-overload-croffles.png",
        variations: [reg(11000)],
      },
    ],
  },
  {
    slug: "chicken",
    name: "Chicken & Sandwiches",
    items: [
      {
        slug: "chick-n-fries",
        name: "Chick'n Fries",
        description: "Chicken fillet, crispy fries, choose a sauce.",
        image: "/images/menu/food/chick-n-fries.png",
        isBestseller: true,
        variations: [reg(17500)],
      },
      {
        slug: "chick-n-buns",
        name: "Chick'n Buns",
        description: "Buns, chicken fillet, veggies, sauce.",
        image: "/images/menu/food/chick-n-buns.png",
        isBestseller: true,
        variations: [reg(16500)],
      },
      {
        slug: "chicken-ham-overload-sandwich",
        name: "Chicken & Ham Overload Sandwich",
        description: "Wheat bread, chicken fillet, ham, cheese, veggies.",
        image: "/images/menu/food/chicken-and-ham-overload-sandwich.png",
        isBestseller: true,
        variations: [reg(17500)],
      },
      {
        slug: "taco-burger",
        name: "Taco Burger",
        description: "Beef-packed tortilla, veggies, sauces, dip.",
        image: "/images/menu/food/taco-burger.png",
        isBestseller: true,
        variations: [reg(14000)],
      },
      {
        slug: "chicken-salad",
        name: "Chicken Salad",
        description: "Chicken fillet, veggies, sauces.",
        image: "/images/menu/food/chick-n-salad.png",
        variations: [reg(18000)],
      },
    ],
  },
  {
    slug: "sides",
    name: "Sides",
    items: [
      {
        slug: "chick-n-chips",
        name: "Chick'n Chips",
        description: "Crispy chicken bites with chips.",
        image: "/images/menu/food/chick-n-chips.png",
        isBestseller: true,
        variations: [reg(14000)],
      },
      {
        slug: "nori-bites",
        name: "Nori Bites",
        description: "Crispy nori-seasoned bites.",
        image: "/images/menu/food/nori-bites.png",
        variations: [reg(15000)],
      },
      {
        slug: "wings-n-rice",
        name: "Wings & Rice",
        description: "Wings + garlic rice.",
        image: "/images/menu/food/wings-n-rice.png",
        variations: [reg(19000)],
      },
      {
        slug: "wings-n-wedges",
        name: "Wings & Wedges",
        description: "Wings + potato wedges.",
        image: "/images/menu/food/wings-n-wedges.png",
        variations: [reg(24500)],
      },
      {
        slug: "shawarma-fries",
        name: "Shawarma Fries",
        description: "Fries topped with shawarma seasoning and sauce.",
        image: "/images/menu/food/shawarma-fries.png",
        variations: [reg(16000)],
      },
      {
        slug: "fries-wedges-with-dip",
        name: "Fries & Wedges with Dip",
        description: "Fries, wedges, choice of dip.",
        image: "/images/menu/food/fries-n-wedges.png",
        variations: [reg(12500)],
      },
      {
        slug: "flavored-fries",
        name: "Flavored Fries",
        description: "Fries with your choice of seasoning.",
        image: "/images/menu/food/flavored-fries.png",
        variations: [reg(11000)],
      },
      {
        slug: "quesadilla",
        name: "Quesadilla",
        description: "Cheese-stuffed quesadilla, your choice of filling.",
        image: "/images/menu/food/quesadilla.png",
        variations: [
          { label: "Chicken", priceCents: 14000, isDefault: true },
          { label: "Beef", priceCents: 14500 },
        ],
      },
      {
        slug: "nachos-overload",
        name: "Nachos Overload",
        description: "Cheesy nachos loaded with your choice of meat.",
        image: "/images/menu/food/cheesy-nachos-overload.png",
        variations: [
          { label: "Chicken", priceCents: 24000, isDefault: true },
          { label: "Beef", priceCents: 24500 },
        ],
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

export function findItemBySlug(slug: string): StaticItem | undefined {
  for (const cat of STATIC_MENU) {
    const found = cat.items.find((i) => i.slug === slug);
    if (found) return found;
  }
  return undefined;
}

// ----------------------------------------------------------------------
// Menu groups — top-level "Click a card to explore" landing on /menu.
// Each group either bundles a list of categories, or pulls all
// bestsellers across the menu.
// ----------------------------------------------------------------------

export type MenuGroup = {
  slug: string;
  name: string;
  blurb: string;
  // Tiny uppercase pill at the top of the card ("DRINKS", "FOOD", "TOP TIER").
  kind: string;
  // If `categorySlugs` is provided, the group renders those category
  // sections in order. If `bestsellersOnly` is true, it renders all
  // bestseller items in a single grid instead.
  categorySlugs?: string[];
  bestsellersOnly?: boolean;
  // Real product photo used as the card centerpiece.
  previewImage: string;
  // Tiled themed pattern shown behind the centerpiece.
  patternImage: string;
};

export const MENU_GROUPS: MenuGroup[] = [
  {
    slug: "coffee-based",
    name: "Coffee Based",
    blurb: "Espresso, lattes, the Zomboss.",
    kind: "Drinks · Coffee",
    categorySlugs: ["signature-drinks", "coffee"],
    previewImage: "/images/menu/drinks/spanish-latte.png",
    patternImage: "/images/brand/patterns/coffee.svg",
  },
  {
    slug: "non-coffee-based",
    name: "Non-Coffee Based",
    blurb: "Matcha, milks, sparkling, tea.",
    kind: "Drinks · Non-Coffee",
    categorySlugs: [
      "matcha",
      "milk-series",
      "creamcheese-series",
      "sparkling",
      "tea",
    ],
    previewImage: "/images/menu/drinks/matcha-latte.png",
    patternImage: "/images/brand/patterns/non-coffee.svg",
  },
  {
    slug: "food",
    name: "Food",
    blurb: "Bowls, croffles, sandwiches, sides.",
    kind: "Munchies",
    categorySlugs: ["rice-bowls", "toasts", "croffles", "chicken", "sides"],
    previewImage: "/images/menu/food/burger-steak.png",
    patternImage: "/images/brand/patterns/food.svg",
  },
  {
    slug: "best-sellers",
    name: "Best Sellers",
    blurb: "The ones we'll fight you about.",
    kind: "Top Tier",
    bestsellersOnly: true,
    previewImage: "/images/menu/drinks/zomboss-latte.png",
    patternImage: "/images/brand/patterns/bestsellers.svg",
  },
];

export function findGroup(slug: string): MenuGroup | undefined {
  return MENU_GROUPS.find((g) => g.slug === slug);
}

/** Items in a group — flat list, used for Best Sellers and counts. */
export function getGroupItems(group: MenuGroup): StaticItem[] {
  if (group.bestsellersOnly) {
    return getBestsellers(100);
  }
  const out: StaticItem[] = [];
  for (const slug of group.categorySlugs ?? []) {
    const cat = STATIC_MENU.find((c) => c.slug === slug);
    if (cat) out.push(...cat.items);
  }
  return out;
}

/** Categories in a group — used for sectioned rendering. */
export function getGroupCategories(group: MenuGroup): StaticCategory[] {
  if (group.bestsellersOnly) return [];
  const out: StaticCategory[] = [];
  for (const slug of group.categorySlugs ?? []) {
    const cat = STATIC_MENU.find((c) => c.slug === slug);
    if (cat) out.push(cat);
  }
  return out;
}
