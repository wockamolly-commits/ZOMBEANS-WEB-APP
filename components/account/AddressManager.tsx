"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, MapPin, Star, Trash2 } from "lucide-react";
import { Select } from "@base-ui/react/select";
import { DELIVERY_TIERS } from "@/lib/checkout";
import { formatPeso } from "@/lib/peso";
import type { SavedAddress } from "@/lib/auth";
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressState,
} from "@/app/account/actions";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initial: AddressState = { status: "idle" };

export function AddressManager({ addresses }: { addresses: SavedAddress[] }) {
  const [state, action, pending] = useActionState(addAddress, initial);
  const [tier, setTier] = useState("");
  return (
    <div className="space-y-5">
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-zb-sage/25 bg-zb-primary-dark/35 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-zb-cream">
                  {a.label || "Address"}
                  {a.is_default && <span className="ml-2 text-xs font-semibold text-zb-bone">Default</span>}
                </p>
                <p className="mt-0.5 truncate text-sm text-zb-cream/65">
                  {a.street}{a.barangay ? `, ${a.barangay}` : ""} · {a.city}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!a.is_default && (
                  <form action={setDefaultAddress.bind(null, a.id)}>
                    <button type="submit" aria-label={`Set "${a.label || "address"}" as default`} title="Set default" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-bone">
                      <Star className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
                <form action={deleteAddress.bind(null, a.id)}>
                  <button type="submit" aria-label={`Delete "${a.label || "address"}"`} title="Delete" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-danger">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zb-cream">
          Label <span className="font-normal text-zb-cream/45">(optional)</span>
          <input name="label" className={inputClass} placeholder="Home" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Distance tier
          <Select.Root items={DELIVERY_TIERS} name="tier" required value={tier} onValueChange={(value) => setTier(value ?? "")}>
            <Select.Trigger className="group mt-2 flex h-11 w-full items-center rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-left text-sm text-zb-cream outline-none transition hover:border-zb-sage data-[popup-open]:border-zb-bone data-[popup-open]:ring-2 data-[popup-open]:ring-zb-bone/20 focus-visible:border-zb-bone focus-visible:ring-2 focus-visible:ring-zb-bone/20">
              <MapPin className="mr-3 size-4 shrink-0 text-zb-bone" />
              <Select.Value placeholder="Choose distance" className="flex-1 truncate" />
              <ChevronDown className="ml-3 size-4 shrink-0 text-zb-cream/50 transition group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-zb-bone" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={8} align="start" alignItemWithTrigger={false} className="z-50">
                <Select.Popup className="w-[var(--anchor-width)] min-w-64 origin-[var(--transform-origin)] rounded-2xl border border-zb-bone/45 bg-zb-primary-dark p-2 text-zb-cream shadow-[0_24px_70px_rgba(0,0,0,0.55)] outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zb-bone/75">
                    Distance from Zombeans
                  </div>
                  <Select.List className="overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(229,192,123,0.6)_transparent] [scrollbar-width:thin]">
                    {DELIVERY_TIERS.map((t) => (
                      <Select.Item
                        key={t.value}
                        value={t.value}
                        className="grid min-h-11 cursor-default grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-3 text-sm outline-none transition text-zb-cream/75 data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:font-bold data-[selected]:text-zb-primary-dark"
                      >
                        <Select.ItemText>{t.label}</Select.ItemText>
                        <span className="font-mono-tabular text-xs">{formatPeso(t.feeCents)}</span>
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
        </label>
        <label className="text-sm font-medium text-zb-cream sm:col-span-2">
          Street
          <input name="street" required className={inputClass} placeholder="House number, street, subdivision" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Barangay
          <input name="barangay" className={inputClass} placeholder="Barangay" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Landmark
          <input name="landmark" className={inputClass} placeholder="Near the red gate" />
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55">
            {pending ? "Saving…" : "Add address"}
          </button>
          {state.status === "added" && <span aria-live="polite" className="text-sm text-zb-bone">Added.</span>}
          {state.status === "error" && <span role="alert" className="text-sm text-zb-danger">{state.message}</span>}
        </div>
      </form>
    </div>
  );
}
