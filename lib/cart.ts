export const CART_STORAGE_KEY = "zombeans-cart-v1";
export const CART_UPDATED_EVENT = "zombeans-cart-updated";

export type CartModifier = {
  id: string;
  groupName: string;
  name: string;
  priceDeltaCents: number;
  quantity: number;
};

export type CartLine = {
  id: string;
  itemSlug: string;
  groupSlug: string;
  name: string;
  image: string;
  variationLabel: string;
  unitPriceCents: number;
  quantity: number;
  modifiers?: CartModifier[];
  itemNote?: string;
};

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(CART_STORAGE_KEY);
    return value ? normalizeCartLines(JSON.parse(value) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function getCartQuantity(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function getCartSubtotal(lines: CartLine[]) {
  return lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0
  );
}

export function getModifierDisplayName(modifier: CartModifier) {
  const quantity = getModifierQuantity(modifier);
  return quantity > 1 ? `${modifier.name} x${quantity}` : modifier.name;
}

export function getModifierLinePriceCents(modifier: CartModifier) {
  return modifier.priceDeltaCents * getModifierQuantity(modifier);
}

export function getModifierQuantity(modifier: CartModifier) {
  return allowsModifierQuantity(modifier.name)
    ? normalizeQuantity(modifier.quantity)
    : 1;
}

function normalizeCartLines(lines: CartLine[]) {
  return lines.map((line) => ({
    ...line,
    modifiers: line.modifiers?.map((modifier) => ({
      ...modifier,
      quantity: normalizeQuantity(modifier.quantity),
    })),
  }));
}

export function normalizeQuantity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(50, Math.trunc(value)))
    : 1;
}

function allowsModifierQuantity(name: string) {
  return name.trim().toLowerCase() === "espresso";
}
