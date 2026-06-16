"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getCartSubtotal,
  readCart,
  writeCart,
  type CartLine,
} from "@/lib/cart";
import { formatPeso } from "@/lib/peso";

export function CartView() {
  const [lines, setLines] = useState<CartLine[] | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLines(readCart()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function update(next: CartLine[]) {
    setLines(next);
    writeCart(next);
  }

  function changeQuantity(id: string, delta: number) {
    update(
      (lines ?? []).map((line) =>
        line.id === id
          ? { ...line, quantity: Math.max(1, Math.min(20, line.quantity + delta)) }
          : line
      )
    );
  }

  if (lines === null) {
    return <div className="min-h-64" aria-label="Loading cart" />;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <ShoppingBag className="mx-auto size-12 text-zb-bone" />
        <h1 className="mt-5 font-display text-5xl">YOUR CART IS EMPTY</h1>
        <p className="mt-3 text-zb-cream/70">Pick something worth waking up for.</p>
        <Link
          href="/menu"
          className="mt-7 inline-flex h-11 items-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark hover:bg-zb-bone-soft"
        >
          Browse the menu
        </Link>
      </div>
    );
  }

  const subtotal = getCartSubtotal(lines);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3">
        {lines.map((line) => (
          <article
            key={line.id}
            className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center"
          >
            <Link
              href={`/menu/${line.groupSlug}/${line.itemSlug}`}
              className="relative aspect-square overflow-hidden rounded-xl bg-zb-cream/90"
            >
              <Image src={line.image} alt="" fill sizes="112px" className="object-contain p-2" />
            </Link>
            <div>
              <Link href={`/menu/${line.groupSlug}/${line.itemSlug}`} className="font-semibold hover:text-zb-bone">
                {line.name}
              </Link>
              <p className="mt-1 text-sm text-zb-cream/60">{line.variationLabel}</p>
              <p className="mt-2 font-mono-tabular text-sm text-zb-bone">
                {formatPeso(line.unitPriceCents)} each
              </p>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
              <div className="inline-flex items-center rounded-lg border border-zb-sage/30">
                <button type="button" aria-label={`Decrease ${line.name}`} onClick={() => changeQuantity(line.id, -1)} className="inline-flex size-9 items-center justify-center hover:bg-zb-sage/20">
                  <Minus className="size-3.5" />
                </button>
                <span className="w-9 text-center font-mono-tabular text-sm">{line.quantity}</span>
                <button type="button" aria-label={`Increase ${line.name}`} onClick={() => changeQuantity(line.id, 1)} className="inline-flex size-9 items-center justify-center hover:bg-zb-sage/20">
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular font-bold text-zb-bone">
                  {formatPeso(line.unitPriceCents * line.quantity)}
                </span>
                <button type="button" aria-label={`Remove ${line.name}`} onClick={() => update(lines.filter((entry) => entry.id !== line.id))} className="text-zb-cream/45 hover:text-zb-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <aside className="h-fit rounded-2xl border border-zb-sage/30 bg-zb-primary-strong p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-3xl">ORDER SUMMARY</h2>
        <div className="mt-5 flex justify-between border-b border-zb-sage/25 pb-4 text-zb-cream/70">
          <span>Subtotal</span>
          <span className="font-mono-tabular text-zb-cream">{formatPeso(subtotal)}</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-zb-cream/55">
          Service mode, fees, and payment are selected at checkout.
        </p>
        <Link
          href="/checkout"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft"
        >
          Continue to checkout
        </Link>
      </aside>
    </div>
  );
}
