"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CART_UPDATED_EVENT,
  getCartQuantity,
  readCart,
} from "@/lib/cart";

export function CartLink() {
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    const refresh = () => setQuantity(getCartQuantity(readCart()));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(CART_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CART_UPDATED_EVENT, refresh);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={`Cart${quantity ? `, ${quantity} items` : ""}`}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-zb-cream hover:bg-zb-primary-strong transition"
    >
      <ShoppingBag className="size-5" />
      {quantity > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-zb-bone px-1 text-center font-mono text-[10px] font-bold leading-5 text-zb-primary-dark">
          {quantity > 99 ? "99+" : quantity}
        </span>
      )}
    </Link>
  );
}
