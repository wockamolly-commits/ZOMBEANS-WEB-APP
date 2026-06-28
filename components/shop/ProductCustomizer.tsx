"use client";

import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/lib/peso";
import { readCart, writeCart } from "@/lib/cart";
import type { StaticItem } from "@/lib/menu-static";
import type { StorefrontOptionGroup } from "@/lib/storefront-options";

export function ProductCustomizer({
  item,
  groupSlug,
  optionGroups,
}: {
  item: StaticItem;
  groupSlug: string;
  optionGroups: StorefrontOptionGroup[];
}) {
  const router = useRouter();
  const defaultIndex = Math.max(
    0,
    item.variations.findIndex((variation) => variation.isDefault)
  );
  const [variationIndex, setVariationIndex] = useState(defaultIndex);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [itemNote, setItemNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, Record<string, number>>
  >({});
  const variation = item.variations[variationIndex];
  const selectedModifiers = optionGroups.flatMap((group) => {
    const selected = selectedOptions[group.id] ?? {};
    return group.options
      .filter((option) => (selected[option.id] ?? 0) > 0)
      .map((option) => ({
        id: option.id,
        groupName: group.name,
        name: option.name,
        priceDeltaCents: option.priceDeltaCents,
        quantity: allowsOptionQuantity(option.name)
          ? (selected[option.id] ?? 1)
          : 1,
      }));
  });
  const modifierTotal = selectedModifiers.reduce(
    (sum, option) => sum + option.priceDeltaCents * option.quantity,
    0
  );
  const selectedAddOnCount = selectedModifiers.reduce(
    (sum, option) => sum + option.quantity,
    0
  );
  const unitPrice = variation.priceCents + modifierTotal;
  const total = unitPrice * quantity;
  const selectionValid = optionGroups.every((group) => {
    const count = getSelectedOptionCount(selectedOptions[group.id]);
    return count >= group.minSelect && count <= group.maxSelect;
  });

  function changeOptionQuantity(
    group: StorefrontOptionGroup,
    optionId: string,
    delta: number
  ) {
    setSelectedOptions((current) => {
      const quantities = { ...(current[group.id] ?? {}) };
      const currentQuantity = quantities[optionId] ?? 0;
      const selectedCount = getSelectedOptionCount(quantities);

      if (
        delta > 0 &&
        currentQuantity === 0 &&
        group.maxSelect > 1 &&
        selectedCount >= group.maxSelect
      ) {
        return current;
      }

      const nextQuantity = Math.max(
        0,
        Math.min(20, currentQuantity + delta)
      );
      if (nextQuantity === 0) {
        delete quantities[optionId];
      } else if (group.maxSelect === 1 && currentQuantity === 0) {
        return { ...current, [group.id]: { [optionId]: nextQuantity } };
      } else {
        quantities[optionId] = nextQuantity;
      }

      return { ...current, [group.id]: quantities };
    });
  }

  function toggleOption(group: StorefrontOptionGroup, optionId: string) {
    setSelectedOptions((current) => {
      const quantities = { ...(current[group.id] ?? {}) };
      const currentQuantity = quantities[optionId] ?? 0;
      const selectedCount = getSelectedOptionCount(quantities);

      if (currentQuantity > 0) {
        delete quantities[optionId];
        return { ...current, [group.id]: quantities };
      }

      if (group.maxSelect === 1) {
        return { ...current, [group.id]: { [optionId]: 1 } };
      }
      if (selectedCount >= group.maxSelect) return current;

      return { ...current, [group.id]: { ...quantities, [optionId]: 1 } };
    });
  }

  function saveConfiguredLine() {
    const lines = readCart();
    const modifierKey = selectedModifiers
      .map((modifier) => `${modifier.id}:${modifier.quantity}`)
      .sort()
      .join(",");
    const normalizedNote = itemNote.trim();
    const id = `${item.slug}:${variation.label}:${modifierKey}:${encodeURIComponent(
      normalizedNote
    )}`;
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
        unitPriceCents: unitPrice,
        quantity,
        modifiers: selectedModifiers,
        itemNote: normalizedNote || undefined,
      });
    }

    writeCart(lines);
  }

  function addToCart() {
    saveConfiguredLine();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function proceedToCheckout() {
    if (!selectionValid) return;
    saveConfiguredLine();
    router.push("/checkout");
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/65">
          Choose variation
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {item.variations.map((option, index) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setVariationIndex(index)}
              className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left transition ${
                variationIndex === index
                  ? "border-zb-bone bg-zb-bone/12 text-zb-cream shadow-[inset_0_0_0_1px_rgba(229,192,123,0.08)]"
                  : "border-zb-sage/30 bg-zb-primary/45 text-zb-cream/70 hover:border-zb-sage hover:bg-zb-primary/70"
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

      {optionGroups.map((group) => {
        const selected = selectedOptions[group.id] ?? {};
        const selectedCount = getSelectedOptionCount(selected);
        return (
          <fieldset key={group.id}>
            <div className="flex items-end justify-between gap-3">
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/65">
                {group.name}
              </legend>
              <span className="text-[11px] text-zb-cream/45">
                {group.minSelect > 0
                  ? `Choose ${group.minSelect}${group.maxSelect !== group.minSelect ? `–${group.maxSelect}` : ""}`
                  : group.maxSelect === 1
                    ? "Optional"
                    : `Up to ${group.maxSelect}`}
              </span>
            </div>
            {group.description && (
              <p className="mt-1 text-xs text-zb-cream/45">{group.description}</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => {
                const optionQuantity = selected[option.id] ?? 0;
                const checked = optionQuantity > 0;
                const canAdjustQuantity = allowsOptionQuantity(option.name);
                const addDisabled =
                  optionQuantity === 0 &&
                  group.maxSelect > 1 &&
                  selectedCount >= group.maxSelect;
                if (!canAdjustQuantity) {
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role={group.maxSelect === 1 ? "radio" : "checkbox"}
                      aria-checked={checked}
                      disabled={addDisabled}
                      onClick={() => toggleOption(group, option.id)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        checked
                          ? "border-zb-bone bg-zb-bone/12 text-zb-cream shadow-[inset_0_0_0_1px_rgba(229,192,123,0.08)]"
                          : "border-zb-sage/30 bg-zb-primary/45 text-zb-cream/70 hover:border-zb-sage hover:bg-zb-primary/70"
                      }`}
                    >
                      <span className="truncate font-medium">
                        {option.name}
                      </span>
                      <span className="font-mono-tabular text-xs text-zb-bone">
                        {option.priceDeltaCents > 0
                          ? `+${formatPeso(option.priceDeltaCents)}`
                          : "Included"}
                      </span>
                    </button>
                  );
                }

                return (
                  <div
                    key={option.id}
                    role={group.maxSelect === 1 ? "radio" : "checkbox"}
                    aria-checked={checked}
                    className={`grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-4 py-2 text-left transition ${
                      checked
                        ? "border-zb-bone bg-zb-bone/12 text-zb-cream shadow-[inset_0_0_0_1px_rgba(229,192,123,0.08)]"
                        : "border-zb-sage/30 bg-zb-primary/45 text-zb-cream/70 hover:border-zb-sage hover:bg-zb-primary/70"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {option.name}
                      </span>
                      <span className="block font-mono-tabular text-xs text-zb-bone">
                        {option.priceDeltaCents > 0
                          ? `+${formatPeso(option.priceDeltaCents)}`
                          : "Included"}
                      </span>
                    </span>
                    <span className="inline-flex items-center rounded-lg border border-zb-sage/30 bg-zb-primary-dark/30 p-0.5">
                      <button
                        type="button"
                        aria-label={`Decrease ${option.name}`}
                        disabled={!checked}
                        onClick={() =>
                          changeOptionQuantity(group, option.id, -1)
                        }
                        className="inline-flex size-8 items-center justify-center rounded-md transition hover:bg-zb-sage/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono-tabular text-sm">
                        {optionQuantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${option.name}`}
                        disabled={addDisabled}
                        onClick={() =>
                          changeOptionQuantity(group, option.id, 1)
                        }
                        className="inline-flex size-8 items-center justify-center rounded-md transition hover:bg-zb-sage/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="grid items-start gap-5 sm:grid-cols-[10rem_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/65">
            Quantity
          </p>
          <div className="mt-3 inline-flex items-center rounded-xl border border-zb-sage/30 bg-zb-primary/45 p-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="inline-flex size-9 items-center justify-center rounded-lg transition hover:bg-zb-sage/20"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-mono-tabular">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((value) => Math.min(20, value + 1))}
              className="inline-flex size-9 items-center justify-center rounded-lg transition hover:bg-zb-sage/20"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/65">
            Item note
          </span>
          <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-zb-cream/35">
            Optional
          </span>
          <textarea
            value={itemNote}
            onChange={(event) => setItemNote(event.target.value.slice(0, 240))}
            rows={2}
            placeholder="Less ice, no straw, allergy note..."
            className="mt-3 min-h-20 w-full resize-none rounded-xl border border-zb-sage/30 bg-zb-primary/45 px-4 py-3 text-sm text-zb-cream outline-none placeholder:text-zb-cream/30 focus:border-zb-bone focus:ring-2 focus:ring-zb-bone/15"
          />
          <span className="mt-1 block text-right text-[10px] text-zb-cream/30">
            {itemNote.length}/240
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-zb-sage/25 bg-zb-primary/55 p-3 shadow-[0_18px_40px_rgba(8,18,9,0.16)] sm:p-4">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zb-cream/45">
              Order total
            </p>
            <p className="mt-1 text-xs text-zb-cream/45">
              {quantity} {quantity === 1 ? "item" : "items"}
              {selectedAddOnCount > 0
                ? ` · ${selectedAddOnCount} add-on${selectedAddOnCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <span className="font-mono-tabular text-2xl font-bold text-zb-bone">
            {formatPeso(total)}
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-[0.82fr_1.18fr]">
        <Button
          type="button"
          onClick={addToCart}
          disabled={!selectionValid}
          size="lg"
          variant="outline"
          className="h-12 justify-center rounded-xl border-zb-bone/40 bg-transparent px-4 text-zb-cream hover:bg-zb-bone/10"
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
            {added ? "Added to cart" : "Add to cart"}
          </span>
        </Button>
        <Button
          type="button"
          onClick={proceedToCheckout}
          disabled={!selectionValid}
          size="lg"
          className="h-12 justify-center rounded-xl bg-zb-bone px-4 text-zb-primary-dark shadow-[0_8px_20px_rgba(229,192,123,0.15)] hover:bg-zb-bone-soft"
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            {selectionValid ? "Proceed to checkout" : "Complete choices"}
            <ArrowRight className="size-4" />
          </span>
        </Button>
        </div>
      </div>
    </div>
  );
}

function getSelectedOptionCount(options: Record<string, number> | undefined) {
  return Object.values(options ?? {}).filter((quantity) => quantity > 0).length;
}

function allowsOptionQuantity(name: string) {
  return name.trim().toLowerCase() === "espresso";
}
