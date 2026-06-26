"use client";

import {
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coffee,
  ImagePlus,
  Layers3,
  Link2,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Select } from "@base-ui/react/select";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkOptionGroup,
  saveCategory,
  saveOption,
  saveOptionGroup,
  saveProduct,
  setOptionAvailability,
  setProductAvailability,
  type MenuActionResult,
} from "@/app/workspace/menu/actions";
import type {
  ManagedCategory,
  ManagedMenuItem,
  ManagedOption,
  ManagedOptionGroup,
  MenuManagementData,
  MenuVariation,
} from "@/lib/menu-management-types";

type Tab = "products" | "options";
type Modal =
  | { kind: "category"; category?: ManagedCategory }
  | { kind: "product"; item?: ManagedMenuItem; categoryId: string }
  | { kind: "group"; group?: ManagedOptionGroup }
  | { kind: "option"; groupId: string; option?: ManagedOption }
  | { kind: "links"; group: ManagedOptionGroup }
  | { kind: "availability"; item: ManagedMenuItem }
  | null;

type AvailabilityHold =
  | { kind: "today"; unavailableUntil: string }
  | { kind: "indefinite"; unavailableUntil?: null }
  | { kind: "until"; unavailableUntil: string };

const inputClass =
  "w-full rounded-xl border border-zb-sage/25 bg-zb-primary px-3 py-2.5 text-sm text-zb-cream outline-none transition placeholder:text-zb-cream/30 focus:border-zb-bone/70 focus:ring-2 focus:ring-zb-bone/10";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-zb-cream/55";

function peso(cents: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function toCents(value: string): number {
  return Math.round(Math.max(0, Number(value) || 0) * 100);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatStatusUntil(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getTodayRestoreAt() {
  return addDays(startOfLocalDay(new Date()), 1);
}

function getUpcomingRestoreOptions() {
  const tomorrow = getTodayRestoreAt();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(tomorrow, index);
    return {
      label:
        index === 0
          ? "Tomorrow"
          : new Intl.DateTimeFormat("en-PH", { weekday: "long" }).format(date),
      date,
      value: date.toISOString(),
    };
  });
}

function getAvailabilityStatus(item: ManagedMenuItem) {
  if (item.is_active) return "Available";
  if (item.unavailability_kind === "today") return "Unavailable today";
  if (item.unavailability_kind === "until") {
    const until = formatStatusUntil(item.unavailable_until);
    return until ? `Unavailable until ${until}` : "Temporarily unavailable";
  }
  return "Unavailable indefinitely";
}

function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-zb-sage" : "bg-zb-primary/20"
      } disabled:cursor-wait disabled:opacity-50`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full shadow transition ${
          checked ? "bg-zb-bone" : "bg-white"
        } ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-zb-primary/8 text-zb-primary">
        <PackageOpen className="size-6" />
      </div>
      <h3 className="mt-4 font-semibold text-zb-primary-dark">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zb-primary/55">{copy}</p>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-zb-sage/25 bg-zb-primary-strong shadow-2xl sm:rounded-3xl"
      >
        <header className="z-10 flex shrink-0 items-start justify-between gap-4 border-b border-zb-sage/20 bg-zb-primary-strong px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-2xl text-zb-cream">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-zb-cream/50">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-zb-sage/25 text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-cream"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="menu-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </section>
    </div>
  );
}

function FormMessage({ result }: { result: MenuActionResult | null }) {
  if (!result || result.ok) return null;
  return (
    <p className="flex items-center gap-2 rounded-xl border border-zb-danger/30 bg-zb-danger/10 p-3 text-sm text-zb-danger">
      <CircleAlert className="size-4 shrink-0" />
      {result.error}
    </p>
  );
}

function AvailabilityModal({
  item,
  onDone,
  onCancel,
}: {
  item: ManagedMenuItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  const restoreOptions = useMemo(() => getUpcomingRestoreOptions(), []);
  const [selected, setSelected] = useState<AvailabilityHold>({
    kind: "today",
    unavailableUntil: getTodayRestoreAt().toISOString(),
  });

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const response = await setProductAvailability(item.id, false, selected);
      setResult(response);
      if (response.ok) onDone();
    });
  };

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="rounded-2xl border border-zb-sage/25 bg-zb-primary/55 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zb-bone">
          Product
        </p>
        <p className="mt-1 font-semibold text-zb-cream">{item.name}</p>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() =>
            setSelected({
              kind: "today",
              unavailableUntil: getTodayRestoreAt().toISOString(),
            })
          }
          className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition ${
            selected.kind === "today"
              ? "border-zb-bone bg-zb-bone/12"
              : "border-zb-sage/25 bg-zb-primary/45 hover:border-zb-sage"
          }`}
        >
          <Clock3 className="size-5 shrink-0 text-zb-bone" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Unavailable for today</span>
            <span className="mt-0.5 block text-xs text-zb-cream/50">
              Restores tomorrow ({formatDayDate(getTodayRestoreAt())})
            </span>
          </span>
          {selected.kind === "today" && <Check className="size-5 text-zb-bone" />}
        </button>

        <button
          type="button"
          onClick={() => setSelected({ kind: "indefinite" })}
          className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition ${
            selected.kind === "indefinite"
              ? "border-zb-bone bg-zb-bone/12"
              : "border-zb-sage/25 bg-zb-primary/45 hover:border-zb-sage"
          }`}
        >
          <CircleAlert className="size-5 shrink-0 text-zb-bone" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Unavailable indefinitely</span>
            <span className="mt-0.5 block text-xs text-zb-cream/50">
              Restores only when a staff member turns it back on.
            </span>
          </span>
          {selected.kind === "indefinite" && (
            <Check className="size-5 text-zb-bone" />
          )}
        </button>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="size-4 text-zb-bone" />
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-zb-cream/70">
            Unavailable until
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {restoreOptions.map((option) => {
            const checked =
              selected.kind === "until" &&
              selected.unavailableUntil === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSelected({
                    kind: "until",
                    unavailableUntil: option.value,
                  })
                }
                className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left transition ${
                  checked
                    ? "border-zb-bone bg-zb-bone text-zb-primary-dark"
                    : "border-zb-sage/25 bg-zb-primary/45 text-zb-cream hover:border-zb-sage"
                }`}
              >
                <span className="font-semibold">{option.label}</span>
                <span className="font-mono-tabular text-sm">
                  {formatDayDate(option.date)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rounded-2xl border border-zb-bone/30 bg-zb-bone/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zb-bone">
          Selected status
        </p>
        <p className="mt-1 text-sm text-zb-cream/75">
          {selected.kind === "indefinite"
            ? "Unavailable indefinitely"
            : `Unavailable until ${formatStatusUntil(selected.unavailableUntil)}`}
        </p>
      </div>

      <FormMessage result={result} />
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-xl border border-zb-sage/35 px-4 py-3 text-sm font-bold text-zb-cream transition hover:bg-zb-primary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-50"
        >
          {pending ? "Updating..." : "Mark unavailable"}
        </button>
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: ManagedCategory;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await saveCategory({
            id: category?.id,
            name: String(form.get("name") ?? ""),
            isActive: form.get("active") === "on",
          });
          setResult(response);
          if (response.ok) onDone();
        });
      }}
    >
      <div>
        <label className={labelClass} htmlFor="category-name">
          Category name
        </label>
        <input
          id="category-name"
          name="name"
          required
          autoFocus
          defaultValue={category?.name}
          placeholder="e.g. Iced Coffee"
          className={inputClass}
        />
      </div>
      <label className="flex items-center justify-between rounded-xl border border-zb-sage/20 bg-zb-primary/60 p-3 text-sm">
        Available on the menu
        <input
          name="active"
          type="checkbox"
          defaultChecked={category?.is_active ?? true}
          className="size-4 accent-emerald-500"
        />
      </label>
      <FormMessage result={result} />
      <button
        disabled={pending}
        className="w-full rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-50"
      >
        {pending ? "Saving..." : category ? "Save category" : "Add category"}
      </button>
    </form>
  );
}

type EditableVariation = Pick<
  MenuVariation,
  "id" | "label" | "price_cents" | "is_default" | "is_active"
>;

function ProductForm({
  item,
  categoryId,
  categories,
  optionGroups,
  onDone,
}: {
  item?: ManagedMenuItem;
  categoryId: string;
  categories: ManagedCategory[];
  optionGroups: ManagedOptionGroup[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  const [variations, setVariations] = useState<EditableVariation[]>(
    item?.variations.length
      ? item.variations.map((variation) => ({ ...variation }))
      : [
          {
            id: "",
            label: "Regular",
            price_cents: 0,
            is_default: true,
            is_active: true,
          },
        ]
  );
  const [linkedGroups, setLinkedGroups] = useState(
    new Set(item?.option_links.map((link) => link.group_id) ?? [])
  );
  const [selectedProductCategoryId, setSelectedProductCategoryId] = useState(
    item?.category_id ?? categoryId
  );
  const selectedProductCategoryName =
    categories.find((category) => category.id === selectedProductCategoryId)
      ?.name ?? "Select category";
  const [imageName, setImageName] = useState("");

  const updateVariation = (
    index: number,
    patch: Partial<EditableVariation>
  ) => {
    setVariations((current) =>
      current.map((variation, variationIndex) => {
        if (variationIndex !== index) {
          if (patch.is_default) return { ...variation, is_default: false };
          return variation;
        }
        return { ...variation, ...patch };
      })
    );
  };

  return (
    <form
      className="space-y-6 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set(
          "payload",
          JSON.stringify({
            id: item?.id,
            categoryId: formData.get("categoryId"),
            name: formData.get("name"),
            description: formData.get("description"),
            isActive: formData.get("active") === "on",
            isBestseller: formData.get("bestseller") === "on",
            variations: variations.map((variation) => ({
              id: variation.id,
              label: variation.label,
              priceCents: variation.price_cents,
              isDefault: variation.is_default,
              isActive: variation.is_active,
            })),
            optionGroupIds: [...linkedGroups],
          })
        );
        startTransition(async () => {
          const response = await saveProduct(formData);
          setResult(response);
          if (response.ok) onDone();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="product-name">
            Product name
          </label>
          <input
            id="product-name"
            name="name"
            required
            autoFocus
            defaultValue={item?.name}
            placeholder="Spanish Latte"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} id="product-category-label">
            Category
          </label>
          <Select.Root
            items={categories}
            name="categoryId"
            required
            value={selectedProductCategoryId}
            onValueChange={(value) =>
              setSelectedProductCategoryId(value ?? categoryId)
            }
          >
            <Select.Trigger
              aria-labelledby="product-category-label"
              className="group flex h-12 w-full items-center rounded-xl border border-zb-sage/25 bg-zb-primary px-3 text-left text-sm font-semibold text-zb-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition hover:border-zb-sage/60 data-[popup-open]:border-zb-bone/70 data-[popup-open]:ring-2 data-[popup-open]:ring-zb-bone/10 focus-visible:border-zb-bone/70 focus-visible:ring-2 focus-visible:ring-zb-bone/10"
            >
              <span className="min-w-0 flex-1 truncate">
                {selectedProductCategoryName}
              </span>
              <ChevronDown className="ml-3 size-4 shrink-0 text-zb-cream/55 transition group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-zb-bone" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner
                sideOffset={8}
                align="start"
                alignItemWithTrigger={false}
                className="z-[60]"
              >
                <Select.Popup className="w-[var(--anchor-width)] min-w-72 origin-[var(--transform-origin)] overflow-hidden rounded-2xl border border-zb-bone/35 bg-zb-primary-dark p-2 text-zb-cream shadow-[0_24px_70px_rgba(0,0,0,0.55)] outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zb-bone/75">
                    Product category
                  </div>
                  <Select.List className="max-h-72 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(229,192,123,0.6)_transparent] [scrollbar-width:thin]">
                    {categories.map((category) => (
                      <Select.Item
                        key={category.id}
                        value={category.id}
                        className="grid min-h-11 cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-zb-cream/78 outline-none transition data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:text-zb-primary-dark"
                      >
                        <Select.ItemText>{category.name}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check className="size-4" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="product-description">
          Description
        </label>
        <textarea
          id="product-description"
          name="description"
          rows={3}
          defaultValue={item?.description ?? ""}
          placeholder="A short, cashier-friendly description."
          className={inputClass}
        />
      </div>
      <div>
        <span className={labelClass}>Menu photo</span>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zb-sage/40 bg-zb-primary/50 p-4 transition hover:border-zb-bone/60">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-zb-bone/10 bg-cover bg-center text-zb-bone"
            style={
              item?.image_url
                ? { backgroundImage: `url("${item.image_url}")` }
                : undefined
            }
          >
            {!item?.image_url && <ImagePlus className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {imageName || (item?.image_url ? "Replace current photo" : "Upload a photo")}
            </span>
            <span className="text-xs text-zb-cream/45">
              JPG, PNG, WEBP, or GIF · up to 5 MB
            </span>
          </span>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => setImageName(event.target.files?.[0]?.name ?? "")}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-zb-sage/20 bg-zb-primary/60 p-3 text-sm">
          Available
          <input
            name="active"
            type="checkbox"
            defaultChecked={item?.is_active ?? true}
            className="size-4 accent-emerald-500"
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-zb-sage/20 bg-zb-primary/60 p-3 text-sm">
          Bestseller
          <input
            name="bestseller"
            type="checkbox"
            defaultChecked={item?.is_bestseller ?? false}
            className="size-4 accent-zb-bone"
          />
        </label>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Sizes / variants</h3>
            <p className="text-xs text-zb-cream/45">
              Each product needs at least one price.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setVariations((current) => [
                ...current,
                {
                  id: "",
                  label: "",
                  price_cents: 0,
                  is_default: current.length === 0,
                  is_active: true,
                },
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-zb-bone/35 px-2.5 py-1.5 text-xs font-semibold text-zb-bone"
          >
            <Plus className="size-3.5" /> Add size
          </button>
        </div>
        <div className="space-y-2">
          {variations.map((variation, index) => (
            <div
              key={variation.id || index}
              className="grid gap-2 rounded-xl border border-zb-sage/20 bg-zb-primary/50 p-3 sm:grid-cols-[1fr_140px_auto]"
            >
              <input
                required
                aria-label={`Size ${index + 1} label`}
                value={variation.label}
                onChange={(event) =>
                  updateVariation(index, { label: event.target.value })
                }
                placeholder="16oz"
                className={inputClass}
              />
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-zb-cream/40">₱</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`${variation.label || `Size ${index + 1}`} price`}
                  value={(variation.price_cents / 100).toFixed(2)}
                  onChange={(event) =>
                    updateVariation(index, {
                      price_cents: toCents(event.target.value),
                    })
                  }
                  className={`${inputClass} pl-7`}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <label className="flex items-center gap-1 text-[11px] text-zb-cream/50">
                  <input
                    type="radio"
                    name="defaultVariation"
                    checked={variation.is_default}
                    onChange={() => updateVariation(index, { is_default: true })}
                    className="accent-zb-bone"
                  />
                  Default
                </label>
                <input
                  type="checkbox"
                  checked={variation.is_active}
                  onChange={(event) =>
                    updateVariation(index, { is_active: event.target.checked })
                  }
                  aria-label={`${variation.label || `Size ${index + 1}`} available`}
                  className="size-4 accent-emerald-500"
                />
                {variations.length > 1 && !variation.id && (
                  <button
                    type="button"
                    aria-label="Remove size"
                    onClick={() =>
                      setVariations((current) =>
                        current.filter((_, variationIndex) => variationIndex !== index)
                      )
                    }
                    className="text-zb-cream/35 hover:text-zb-danger"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Linked option groups</h3>
        <p className="mb-3 text-xs text-zb-cream/45">
          Select all reusable modifiers that cashiers can offer with this product.
        </p>
        {optionGroups.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {optionGroups.map((group) => (
              <label
                key={group.id}
                className="flex items-start gap-3 rounded-xl border border-zb-sage/20 bg-zb-primary/50 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={linkedGroups.has(group.id)}
                  onChange={(event) => {
                    setLinkedGroups((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(group.id);
                      else next.delete(group.id);
                      return next;
                    });
                  }}
                  className="mt-0.5 size-4 accent-zb-bone"
                />
                <span>
                  <span className="block font-semibold">{group.name}</span>
                  <span className="text-xs text-zb-cream/45">
                    {group.options.length} options
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zb-sage/25 p-4 text-sm text-zb-cream/45">
            Create an option group first, then link it here.
          </p>
        )}
      </section>
      <FormMessage result={result} />
      <button
        disabled={pending}
        className="w-full rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-50"
      >
        {pending ? "Saving product..." : item ? "Save product" : "Add product"}
      </button>
    </form>
  );
}

function OptionGroupForm({
  group,
  onDone,
}: {
  group?: ManagedOptionGroup;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await saveOptionGroup({
            id: group?.id,
            name: String(form.get("name") ?? ""),
            description: String(form.get("description") ?? ""),
            isActive: form.get("active") === "on",
          });
          setResult(response);
          if (response.ok) onDone();
        });
      }}
    >
      <div>
        <label className={labelClass} htmlFor="group-name">
          Group name
        </label>
        <input
          id="group-name"
          name="name"
          required
          autoFocus
          defaultValue={group?.name}
          placeholder="Choice of Extras for Drinks"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="group-description">
          Staff note
        </label>
        <textarea
          id="group-description"
          name="description"
          rows={3}
          defaultValue={group?.description ?? ""}
          placeholder="Explain when this group should be offered."
          className={inputClass}
        />
      </div>
      <label className="flex items-center justify-between rounded-xl border border-zb-sage/20 bg-zb-primary/60 p-3 text-sm">
        Group available
        <input
          name="active"
          type="checkbox"
          defaultChecked={group?.is_active ?? true}
          className="size-4 accent-emerald-500"
        />
      </label>
      <FormMessage result={result} />
      <button
        disabled={pending}
        className="w-full rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark disabled:opacity-50"
      >
        {pending ? "Saving..." : group ? "Save option group" : "Add option group"}
      </button>
    </form>
  );
}

function OptionForm({
  groupId,
  option,
  onDone,
}: {
  groupId: string;
  option?: ManagedOption;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await saveOption({
            id: option?.id,
            groupId,
            name: String(form.get("name") ?? ""),
            priceDeltaCents: toCents(String(form.get("price") ?? "0")),
            isActive: form.get("active") === "on",
          });
          setResult(response);
          if (response.ok) onDone();
        });
      }}
    >
      <div>
        <label className={labelClass} htmlFor="option-name">
          Option name
        </label>
        <input
          id="option-name"
          name="name"
          required
          autoFocus
          defaultValue={option?.name}
          placeholder="Cold Foam"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="option-price">
          Price adjustment
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-sm text-zb-cream/40">₱</span>
          <input
            id="option-price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={((option?.price_delta_cents ?? 0) / 100).toFixed(2)}
            className={`${inputClass} pl-7`}
          />
        </div>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-zb-sage/20 bg-zb-primary/60 p-3 text-sm">
        Option available
        <input
          name="active"
          type="checkbox"
          defaultChecked={option?.is_active ?? true}
          className="size-4 accent-emerald-500"
        />
      </label>
      <FormMessage result={result} />
      <button
        disabled={pending}
        className="w-full rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark disabled:opacity-50"
      >
        {pending ? "Saving..." : option ? "Save option" : "Add option"}
      </button>
    </form>
  );
}

function LinkProductsForm({
  group,
  categories,
  onDone,
}: {
  group: ManagedOptionGroup;
  categories: ManagedCategory[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(new Set(group.linked_item_ids));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuActionResult | null>(null);
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="max-h-[48dvh] space-y-4 overflow-y-auto pr-1">
        {categories.map((category) => (
          <section key={category.id}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zb-cream/55">
                {category.name}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    const allSelected = category.items.every((item) => next.has(item.id));
                    category.items.forEach((item) =>
                      allSelected ? next.delete(item.id) : next.add(item.id)
                    );
                    return next;
                  })
                }
                className="text-xs font-semibold text-zb-bone"
              >
                Toggle all
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {category.items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-zb-sage/20 bg-zb-primary/50 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                    className="size-4 accent-zb-bone"
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-zb-cream/45">
        {selected.size} product{selected.size === 1 ? "" : "s"} selected
      </p>
      <FormMessage result={result} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const response = await linkOptionGroup({
              groupId: group.id,
              itemIds: [...selected],
            });
            setResult(response);
            if (response.ok) onDone();
          })
        }
        className="w-full rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark disabled:opacity-50"
      >
        {pending ? "Linking products..." : "Save linked products"}
      </button>
    </div>
  );
}

export function MenuManager({
  initialData,
  can,
}: {
  initialData: MenuManagementData;
  can: { configure: boolean; availability: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("products");
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialData.categories[0]?.id ?? ""
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    initialData.optionGroups[0]?.id ?? ""
  );
  const [expanded, setExpanded] = useState(new Set<string>());
  const [modal, setModal] = useState<Modal>(null);
  const [pendingId, setPendingId] = useState("");
  const [, startTransition] = useTransition();

  const selectedCategory =
    initialData.categories.find((category) => category.id === selectedCategoryId) ??
    initialData.categories[0];
  const selectedGroup =
    initialData.optionGroups.find((group) => group.id === selectedGroupId) ??
    initialData.optionGroups[0];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = useMemo(
    () =>
      initialData.categories.filter(
        (category) =>
          !normalizedQuery ||
          category.name.toLowerCase().includes(normalizedQuery) ||
          category.items.some((item) =>
            item.name.toLowerCase().includes(normalizedQuery)
          )
      ),
    [initialData.categories, normalizedQuery]
  );
  const filteredGroups = useMemo(
    () =>
      initialData.optionGroups.filter(
        (group) =>
          !normalizedQuery ||
          group.name.toLowerCase().includes(normalizedQuery) ||
          group.options.some((option) =>
            option.name.toLowerCase().includes(normalizedQuery)
          )
      ),
    [initialData.optionGroups, normalizedQuery]
  );
  const visibleItems =
    selectedCategory?.items.filter(
      (item) =>
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description?.toLowerCase().includes(normalizedQuery)
    ) ?? [];
  const visibleOptions =
    selectedGroup?.options.filter(
      (option) =>
        !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery)
    ) ?? [];

  const closeAndRefresh = () => {
    setModal(null);
    router.refresh();
  };

  const toggleItem = (item: ManagedMenuItem, active: boolean) => {
    if (!active) {
      setModal({ kind: "availability", item });
      return;
    }
    setPendingId(item.id);
    startTransition(async () => {
      await setProductAvailability(item.id, active);
      setPendingId("");
      router.refresh();
    });
  };
  const toggleOption = (option: ManagedOption, active: boolean) => {
    setPendingId(option.id);
    startTransition(async () => {
      await setOptionAvailability(option.id, active);
      setPendingId("");
      router.refresh();
    });
  };

  return (
    <div className="menu-studio-bg -mx-4 -my-6 min-h-[calc(100dvh-7rem)] bg-zb-primary text-zb-cream sm:-mx-6 lg:-mx-8">
      <div className="mx-auto max-w-[1540px] p-4 sm:p-6 lg:p-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-zb-sage/25 bg-zb-primary-strong px-5 py-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] sm:px-7 lg:px-9 lg:py-8">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border-[48px] border-zb-bone/5" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zb-bone">
                <Coffee className="size-3.5" />
                Zombeans Menu Studio
              </div>
              <h1 className="font-display text-4xl leading-none text-zb-cream sm:text-5xl">
                BUILD THE MENU
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zb-cream/55">
                Shape the catalog your team sells from—products, serving sizes,
                availability, and reusable choices in one focused workspace.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  label: "Categories",
                  value: initialData.categories.length,
                  icon: Layers3,
                },
                {
                  label: "Products",
                  value: initialData.categories.reduce(
                    (total, category) => total + category.items.length,
                    0
                  ),
                  icon: Coffee,
                },
                {
                  label: "Option sets",
                  value: initialData.optionGroups.length,
                  icon: Boxes,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="min-w-0 rounded-2xl border border-zb-sage/20 bg-zb-primary/55 p-3 sm:min-w-28 sm:p-4"
                >
                  <Icon className="size-4 text-zb-bone" />
                  <p className="mt-3 font-mono-tabular text-xl font-bold text-zb-cream">
                    {value}
                  </p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-zb-cream/40">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <div className="grid w-full grid-cols-2 rounded-2xl border border-zb-sage/20 bg-zb-primary-strong p-1.5 lg:w-[360px]">
            <button
              onClick={() => setTab("products")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === "products"
                  ? "bg-zb-bone text-zb-primary-dark shadow-lg"
                  : "text-zb-cream/45 hover:text-zb-cream"
              }`}
            >
              <Coffee className="size-4" />
              Products
            </button>
            <button
              onClick={() => setTab("options")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === "options"
                  ? "bg-zb-bone text-zb-primary-dark shadow-lg"
                  : "text-zb-cream/45 hover:text-zb-cream"
              }`}
            >
              <Boxes className="size-4" />
              Options
            </button>
          </div>
          <label className="flex flex-1 items-center gap-3 rounded-2xl border border-zb-sage/20 bg-zb-primary-strong px-4 shadow-sm">
            <Search className="size-4 text-zb-bone/70" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tab === "products" ? "products and categories" : "options and groups"}...`}
              className="h-12 w-full bg-transparent text-sm text-zb-cream outline-none placeholder:text-zb-cream/25"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X className="size-4 text-zb-cream/35" />
              </button>
            )}
          </label>
          <div className="hidden items-center gap-2 rounded-2xl border border-zb-sage/20 bg-zb-primary-strong px-4 text-xs font-semibold uppercase tracking-[0.08em] text-zb-cream/45 shadow-sm sm:flex">
            <SlidersHorizontal className="size-4 text-zb-bone" /> Organized by{" "}
            {tab === "products" ? "category" : "group"}
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 self-start rounded-[1.75rem] border border-zb-sage/20 bg-zb-primary-strong/80 p-3 shadow-xl backdrop-blur lg:sticky lg:top-28">
            <div className="px-2 pb-3 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zb-bone/70">
                {tab === "products" ? "Catalog structure" : "Reusable choices"}
              </p>
              <p className="mt-1 text-xs text-zb-cream/35">
                {tab === "products"
                  ? "Select a category to manage its products."
                  : "Select a set to manage choices and product links."}
              </p>
            </div>
            {can.configure && (
              <button
                onClick={() =>
                  setModal(tab === "products" ? { kind: "category" } : { kind: "group" })
                }
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark shadow-lg transition hover:bg-zb-bone-soft"
              >
                <Plus className="size-4" />
                Add {tab === "products" ? "category" : "option group"}
              </button>
            )}
            <div className="menu-studio-scroll max-h-[min(56dvh,34rem)] space-y-2 overflow-y-auto pr-1">
              {(tab === "products" ? filteredCategories : filteredGroups).map(
                (entry) => {
                  const isCategory = "items" in entry;
                  const selected = isCategory
                    ? entry.id === selectedCategory?.id
                    : entry.id === selectedGroup?.id;
                  const count = isCategory ? entry.items.length : entry.options.length;
                  return (
                    <button
                      key={entry.id}
                      onClick={() =>
                        isCategory
                          ? setSelectedCategoryId(entry.id)
                          : setSelectedGroupId(entry.id)
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-zb-bone/70 bg-zb-bone text-zb-primary-dark shadow-lg"
                          : "border-zb-sage/15 bg-zb-primary/55 text-zb-cream hover:border-zb-sage/45 hover:bg-zb-primary"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {entry.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            selected ? "text-zb-primary/55" : "text-zb-cream/35"
                          }`}
                        >
                          {count} {isCategory ? "products" : "options"}
                          {!entry.is_active && " · hidden"}
                        </span>
                      </span>
                      <span
                        className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ${
                          selected
                            ? "bg-zb-primary/10"
                            : "bg-zb-bone/10 text-zb-bone"
                        }`}
                      >
                        {count}
                      </span>
                      <ChevronRight
                        className={`size-4 ${
                          selected ? "text-zb-primary" : "text-zb-cream/25"
                        }`}
                      />
                    </button>
                  );
                }
              )}
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-zb-bone/15 bg-zb-cream text-zb-primary-dark shadow-[0_24px_60px_-32px_rgba(0,0,0,0.8)]">
            {tab === "products" ? (
              selectedCategory ? (
                <>
                  <header className="flex flex-col gap-4 border-b border-zb-primary/10 bg-[#e7d7c8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="truncate font-display text-3xl">
                            {selectedCategory.name}
                          </h2>
                          {can.configure && (
                            <button
                              onClick={() =>
                                setModal({
                                  kind: "category",
                                  category: selectedCategory,
                                })
                              }
                              className="grid size-9 place-items-center rounded-xl border border-zb-primary/15 bg-zb-cream/60 text-zb-primary/55 transition hover:border-zb-primary/35 hover:text-zb-primary"
                              aria-label="Edit category"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zb-primary/45">
                          {selectedCategory.items.length} products ·{" "}
                          {selectedCategory.is_active ? "Visible" : "Hidden"}
                        </p>
                      </div>
                    </div>
                    {can.configure && (
                      <button
                        onClick={() =>
                          setModal({
                            kind: "product",
                            categoryId: selectedCategory.id,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-zb-primary px-4 py-3 text-sm font-bold text-zb-cream shadow-lg transition hover:bg-zb-primary-strong"
                      >
                        <Plus className="size-4" /> Add product
                      </button>
                    )}
                  </header>
                  {visibleItems.length ? (
                    <div className="space-y-3 p-3 sm:p-4">
                      {visibleItems.map((item) => {
                        const isExpanded = expanded.has(item.id);
                        return (
                          <article
                            key={item.id}
                            {...(can.configure
                              ? {
                                  role: "button" as const,
                                  tabIndex: 0,
                                  "aria-label": `Edit ${item.name}`,
                                  onClick: () =>
                                    setModal({ kind: "product", item, categoryId: item.category_id }),
                                  onKeyDown: (event: React.KeyboardEvent) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      setModal({ kind: "product", item, categoryId: item.category_id });
                                    }
                                  },
                                }
                              : {})}
                            className={`group overflow-hidden rounded-2xl border border-zb-primary/10 bg-[#f7eee6] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone ${
                              can.configure
                                ? "cursor-pointer hover:-translate-y-0.5 hover:border-zb-sage/50 hover:shadow-md"
                                : ""
                            }`}
                          >
                            <div className="flex gap-4 p-4 sm:p-5">
                              <div
                                className="size-16 shrink-0 rounded-2xl border border-zb-primary/10 bg-zb-primary/8 bg-cover bg-center shadow-inner"
                                style={
                                  item.image_url
                                    ? { backgroundImage: `url("${item.image_url}")` }
                                    : undefined
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 text-left">
                                    <span className="flex items-center gap-2">
                                      <span className="truncate font-bold">
                                        {item.name}
                                      </span>
                                      {item.is_bestseller && (
                                        <Sparkles className="size-3.5 shrink-0 text-zb-bone" />
                                      )}
                                    </span>
                                    <span className="mt-1 line-clamp-2 block text-sm leading-5 text-zb-primary/55">
                                      {item.description || "No description yet."}
                                    </span>
                                    <span className="mt-2 flex flex-wrap items-center gap-2">
                                      {!item.is_active && (
                                        <span className="inline-flex items-center gap-1.5 rounded-md border border-zb-primary/10 bg-zb-primary/8 px-2 py-1 text-[11px] font-semibold text-zb-primary/65">
                                          <Clock3 className="size-3 shrink-0 text-zb-primary/45" />
                                          {getAvailabilityStatus(item)}
                                        </span>
                                      )}
                                      {can.configure && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-zb-sage opacity-70 transition group-hover:opacity-100">
                                          <Pencil className="size-3" /> Edit product
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => event.stopPropagation()}
                                  >
                                    <Toggle
                                      checked={item.is_active}
                                      disabled={pendingId === item.id || !can.availability}
                                      label={`${item.is_active ? "Disable" : "Enable"} ${item.name}`}
                                      onChange={(active) => toggleItem(item, active)}
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setExpanded((current) => {
                                      const next = new Set(current);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    })
                                  }}
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zb-sage/10 px-3 py-1.5 text-xs font-bold text-zb-primary"
                                >
                                  {isExpanded ? "Hide sizes" : "Show sizes"}
                                  <ChevronDown
                                    className={`size-3.5 transition ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-zb-primary/8 bg-zb-primary/5 p-2">
                                {item.variations.map((variation) => {
                                  const linkedCount = item.option_links.length;
                                  return (
                                    <div
                                      key={variation.id}
                                      className="flex flex-col gap-3 rounded-xl px-4 py-3 even:bg-zb-cream/70 sm:flex-row sm:items-center"
                                    >
                                      <div className="flex-1">
                                        <p className="font-semibold">
                                          {variation.label}
                                          {!variation.is_active && (
                                            <span className="ml-2 text-xs font-normal text-zb-primary/35">
                                              unavailable
                                            </span>
                                          )}
                                        </p>
                                        {can.configure && (
                                          <button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setModal({
                                                kind: "product",
                                                item,
                                                categoryId: item.category_id,
                                              })
                                            }}
                                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zb-primary/15 bg-zb-cream px-3 py-1.5 text-xs font-bold transition hover:bg-zb-bone/25"
                                          >
                                            View options
                                            {linkedCount > 0 && (
                                              <span className="rounded-full bg-zb-bone/30 px-1.5">
                                                {linkedCount}
                                              </span>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                      <span className="font-mono-tabular font-bold">
                                        {peso(variation.price_cents)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No products found"
                      copy={
                        query
                          ? "Try a different search or clear the search field."
                          : "Add the first product to this category."
                      }
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  title="Create your first category"
                  copy="Categories keep the menu easy to scan for staff and customers."
                />
              )
            ) : selectedGroup ? (
              <>
                <header className="border-b border-zb-primary/10 bg-[#e7d7c8] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-3xl">{selectedGroup.name}</h2>
                        {can.configure && (
                          <button
                            onClick={() =>
                              setModal({ kind: "group", group: selectedGroup })
                            }
                            className="grid size-9 place-items-center rounded-xl border border-zb-primary/15 bg-zb-cream/60 text-zb-primary/55 transition hover:border-zb-primary/35 hover:text-zb-primary"
                            aria-label="Edit option group"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 max-w-2xl text-sm text-zb-primary/50">
                        {selectedGroup.description || "Reusable product modifier group."}
                      </p>
                    </div>
                    {can.configure && (
                      <button
                        onClick={() =>
                          setModal({ kind: "option", groupId: selectedGroup.id })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-zb-primary px-4 py-3 text-sm font-bold text-zb-cream shadow-lg"
                      >
                        <Plus className="size-4" /> Add option
                      </button>
                    )}
                  </div>
                  <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-zb-primary/10 bg-zb-cream/65 p-4 sm:flex-row sm:items-center">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zb-sage/10 text-zb-primary">
                      <Link2 className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-xs font-semibold text-zb-primary/55">
                      {selectedGroup.linked_item_ids.length
                        ? `Linked to ${selectedGroup.linked_item_ids.length} selected product${
                            selectedGroup.linked_item_ids.length === 1 ? "" : "s"
                          }`
                        : "Not linked to any products yet"}
                    </p>
                    {can.configure && (
                      <button
                        onClick={() =>
                          setModal({ kind: "links", group: selectedGroup })
                        }
                        className="rounded-lg bg-zb-bone/35 px-3 py-2 text-xs font-bold text-zb-primary"
                      >
                        Link products
                      </button>
                    )}
                  </div>
                </header>
                {visibleOptions.length ? (
                  <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
                    {visibleOptions.map((option) => (
                    <div
                      key={option.id}
                      {...(can.configure
                        ? {
                            role: "button" as const,
                            tabIndex: 0,
                            "aria-label": `Edit ${option.name}`,
                            onClick: () =>
                              setModal({
                                kind: "option",
                                groupId: selectedGroup.id,
                                option,
                              }),
                            onKeyDown: (event: React.KeyboardEvent) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setModal({
                                  kind: "option",
                                  groupId: selectedGroup.id,
                                  option,
                                });
                              }
                            },
                          }
                        : {})}
                      className={`group flex items-center gap-4 rounded-2xl border border-zb-primary/10 bg-[#f7eee6] p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone ${
                        can.configure
                          ? "cursor-pointer hover:-translate-y-0.5 hover:border-zb-sage/50 hover:shadow-md"
                          : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-bold">{option.name}</span>
                        <span className="mt-1 block text-xs text-zb-primary/45">
                          {option.price_delta_cents
                            ? `+${peso(option.price_delta_cents)}`
                            : "No price adjustment"}
                        </span>
                        {can.configure && (
                          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-zb-sage opacity-70 transition group-hover:opacity-100">
                            <Pencil className="size-3" /> Edit option
                          </span>
                        )}
                      </div>
                      <span className="hidden font-mono-tabular text-sm font-bold text-zb-primary/60 sm:block">
                        +{peso(option.price_delta_cents)}
                      </span>
                      <div
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Toggle
                          checked={option.is_active}
                          disabled={pendingId === option.id || !can.availability}
                          label={`${option.is_active ? "Disable" : "Enable"} ${option.name}`}
                          onChange={(active) => toggleOption(option, active)}
                        />
                      </div>
                    </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No options found"
                    copy={
                      query
                        ? "Try a different search or clear the search field."
                        : "Add choices such as Oatmilk, Espresso, or Cold Foam."
                    }
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="Create your first option group"
                copy="Reusable groups can be linked to one or many products."
              />
            )}
          </section>
        </div>
      </div>

      {modal && (
        <ModalShell
          title={
            modal.kind === "category"
              ? modal.category
                ? "Edit category"
                : "Add category"
              : modal.kind === "product"
                ? modal.item
                  ? "Edit product"
                  : "Add product"
                : modal.kind === "group"
                  ? modal.group
                    ? "Edit option group"
                    : "Add option group"
                  : modal.kind === "option"
                    ? modal.option
                      ? "Edit option"
                      : "Add option"
                    : modal.kind === "availability"
                      ? "Mark unavailable"
                      : `Link products`
          }
          subtitle={
            modal.kind === "links"
              ? `Choose where “${modal.group.name}” should appear.`
              : modal.kind === "availability"
                ? "Choose when this product should return to the menu."
                : undefined
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "category" && (
            <CategoryForm category={modal.category} onDone={closeAndRefresh} />
          )}
          {modal.kind === "product" && (
            <ProductForm
              item={modal.item}
              categoryId={modal.categoryId}
              categories={initialData.categories}
              optionGroups={initialData.optionGroups}
              onDone={closeAndRefresh}
            />
          )}
          {modal.kind === "group" && (
            <OptionGroupForm group={modal.group} onDone={closeAndRefresh} />
          )}
          {modal.kind === "option" && (
            <OptionForm
              groupId={modal.groupId}
              option={modal.option}
              onDone={closeAndRefresh}
            />
          )}
          {modal.kind === "links" && (
            <LinkProductsForm
              group={modal.group}
              categories={initialData.categories}
              onDone={closeAndRefresh}
            />
          )}
          {modal.kind === "availability" && (
            <AvailabilityModal
              item={modal.item}
              onDone={closeAndRefresh}
              onCancel={() => setModal(null)}
            />
          )}
        </ModalShell>
      )}
    </div>
  );
}
