"use client";

import { useEffect } from "react";
import { writeCart } from "@/lib/cart";

export function CartClearOnArrival() {
  useEffect(() => {
    writeCart([]);
  }, []);
  return null;
}
