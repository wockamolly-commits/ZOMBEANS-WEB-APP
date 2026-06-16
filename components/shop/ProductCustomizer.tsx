"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/lib/peso";
import { readCart, writeCart } from "@/lib/cart";
import type { StaticItem } from "@/lib/menu-static";

export function ProductCustomizer({
  item,
  groupSlug,
}: {
  item: StaticItem;
  groupSlug: string;
}) {
  const defaultIndex = Math.max(
    0,
    item.variations.findIndex((variation) => variation.isDefault)
  );
  const [variationIndex, setVariationIndex] = useState(defaultIndex);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const variation = item.variations[variationIndex];
  const total = variation.priceCents * quantity;

  function addToCart() {
    const lines = readCart();
    const id = `${item.slug}:${variation.label}`;
    const existing = lines.find((line) => line.id === id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      lines.push({
        id,
        itemSlug: item.slug,
        groupSlug,
        name: item.name,
        image: item.image,
        variationLabel: variation.label,
        unitPriceCents: variation.priceCents,
        quantity,
      });
    }

    writeCart(lines);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-[0.16em] text-zb-cream/70">
          Choose variation
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {item.variations.map((option, index) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setVariationIndex(index)}
              className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left transition ${
                variationIndex === index
                  ? "border-zb-bone bg-zb-bone/10 text-zb-cream"
                  : "border-zb-sage/35 bg-zb-primary-strong/65 text-zb-cream/75 hover:border-zb-sage"
              }`}
            >
              <span className="font-medium">{option.label}</span>
              <span className="font-mono-tabular text-sm text-zb-bone">
                {formatPeso(option.priceCents)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zb-cream/70">
          Quantity
        </p>
        <div className="mt-3 inline-flex items-center rounded-xl border border-zb-sage/35 bg-zb-primary-strong/65 p-1">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-zb-sage/20"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center font-mono-tabular">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((value) => Math.min(20, value + 1))}
            className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-zb-sage/20"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <Button
        type="button"
        onClick={addToCart}
        size="lg"
        className="h-14 w-full justify-between rounded-xl bg-zb-bone px-5 text-zb-primary-dark hover:bg-zb-bone-soft"
      >
        <span className="inline-flex items-center gap-2 font-semibold">
          {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
          {added ? "Added to cart" : "Add to cart"}
        </span>
        <span className="font-mono-tabular font-bold">{formatPeso(total)}</span>
      </Button>
    </div>
  );
}
