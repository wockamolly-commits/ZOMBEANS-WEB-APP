"use client";

import { useActionState } from "react";
import { Star, Trash2 } from "lucide-react";
import { DELIVERY_TIERS } from "@/lib/checkout";
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
                    <button type="submit" title="Set default" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-bone">
                      <Star className="size-4" />
                    </button>
                  </form>
                )}
                <form action={deleteAddress.bind(null, a.id)}>
                  <button type="submit" title="Delete" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-danger">
                    <Trash2 className="size-4" />
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
          <select name="tier" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose distance</option>
            {DELIVERY_TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
