export const CART_STORAGE_KEY = "zombeans-cart-v1";
export const CART_UPDATED_EVENT = "zombeans-cart-updated";

export type CartModifier = {
  id: string;
  groupName: string;
  name: string;
  priceDeltaCents: number;
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
    return value ? (JSON.parse(value) as CartLine[]) : [];
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
