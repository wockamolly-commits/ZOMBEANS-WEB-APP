"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CART_UPDATED_EVENT,
  getCartQuantity,
  getCartSubtotal,
  readCart,
} from "@/lib/cart";
import { formatPeso } from "@/lib/peso";

// Routes that already surface the cart prominently — no bar needed.
const HIDDEN_PREFIXES = [
  "/cart",
  "/checkout",
  "/order",
  "/workspace",
  "/rider",
  "/login",
  "/account",
];

export function MobileCartBar() {
  const pathname = usePathname();
  const [quantity, setQuantity] = useState(0);
  const [subtotal, setSubtotal] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const lines = readCart();
      setQuantity(getCartQuantity(lines));
      setSubtotal(getCartSubtotal(lines));
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(CART_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CART_UPDATED_EVENT, refresh);
    };
  }, []);

  const hidden =
    quantity === 0 ||
    HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hidden) return null;

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers the footer on mobile. */}
      <div aria-hidden className="h-20 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zb-sage/30 bg-zb-primary/95 backdrop-blur supports-[backdrop-filter]:bg-zb-primary/85 px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Link
          href="/cart"
          className="flex h-16 items-center justify-between gap-4"
          aria-label={`View cart, ${quantity} ${quantity === 1 ? "item" : "items"}, subtotal ${formatPeso(subtotal)}`}
        >
          <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-zb-bone/15 text-zb-bone">
            <ShoppingBag className="size-5" />
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-zb-bone px-1 text-center font-mono text-[10px] font-bold leading-5 text-zb-primary-dark">
              {quantity > 99 ? "99+" : quantity}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-zb-cream/55">
              {quantity} {quantity === 1 ? "item" : "items"} in cart
            </span>
            <span className="block font-mono-tabular text-base font-bold text-zb-cream">
              {formatPeso(subtotal)}
            </span>
          </span>
          <span className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark">
            View cart <ChevronRight className="size-4" />
          </span>
        </Link>
      </div>
    </>
  );
}
