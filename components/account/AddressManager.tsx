"use client";

import { useActionState, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import type { SavedAddress } from "@/lib/auth";
import {
  DeliveryMapPicker,
  type DeliveryDetails,
} from "@/components/shop/DeliveryMapPicker";
import type { DeliveryTier } from "@/lib/delivery";
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressState,
} from "@/app/account/actions";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initial: AddressState = { status: "idle" };

export function AddressManager({
  addresses,
  mapsEnabled,
  mapsApiKey,
  storeLat,
  storeLng,
  deliveryTiers,
  deliveryMaxKm,
}: {
  addresses: SavedAddress[];
  mapsEnabled: boolean;
  mapsApiKey: string | null;
  storeLat: number;
  storeLng: number;
  deliveryTiers: DeliveryTier[];
  deliveryMaxKm: number;
}) {
  const [state, action, pending] = useActionState(addAddress, initial);
  const [details, setDetails] = useState<DeliveryDetails | null>(null);

  return (
    <div className="space-y-5">
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zb-sage/25 bg-zb-primary-dark/35 p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zb-cream">
                  {address.label || "Address"}
                  {address.is_default && (
                    <span className="ml-2 text-xs font-semibold text-zb-bone">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-sm text-zb-cream/65">
                  {address.street}
                  {address.barangay ? `, ${address.barangay}` : ""},{" "}
                  {address.city}
                </p>
                {address.landmark && (
                  <p className="mt-0.5 truncate text-xs text-zb-cream/45">
                    Landmark: {address.landmark}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!address.is_default && (
                  <form action={setDefaultAddress.bind(null, address.id)}>
                    <button
                      type="submit"
                      aria-label={`Set "${address.label || "address"}" as default`}
                      title="Set default"
                      className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-bone"
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
                <form action={deleteAddress.bind(null, address.id)}>
                  <button
                    type="submit"
                    aria-label={`Delete "${address.label || "address"}"`}
                    title="Delete"
                    className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addresses.length === 0 && (
        <p className="rounded-xl border border-zb-bone/30 bg-zb-bone/10 p-4 text-sm leading-6 text-zb-cream/80">
          Add your first delivery address so checkout is faster next time. Type
          it in below
          {mapsEnabled && mapsApiKey
            ? " — and we'll detect your location to confirm the delivery fee."
            : "."}
        </p>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zb-cream">
          Label <span className="font-normal text-zb-cream/45">(optional)</span>
          <input name="label" className={inputClass} placeholder="Home" />
        </label>

        <label className="text-sm font-medium text-zb-cream sm:col-span-2">
          Street
          <input
            name="street"
            required
            autoComplete="street-address"
            className={inputClass}
            placeholder="House number, street, subdivision"
          />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Barangay
          <input name="barangay" className={inputClass} placeholder="Barangay" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Landmark
          <input
            name="landmark"
            className={inputClass}
            placeholder="Near the red gate"
          />
        </label>

        {mapsEnabled && mapsApiKey && (
          <div className="sm:col-span-2 space-y-2">
            <p className="text-sm font-medium text-zb-cream">
              Pin your location{" "}
              <span className="font-normal text-zb-cream/45">
                (optional, improves delivery accuracy)
              </span>
            </p>
            <DeliveryMapPicker
              apiKey={mapsApiKey}
              storeLat={storeLat}
              storeLng={storeLng}
              tiers={deliveryTiers}
              maxKm={deliveryMaxKm}
              onChange={setDetails}
            />
            {details && (
              <p className="text-sm text-zb-cream/70">
                Detected: {details.street}
                {details.barangay ? `, ${details.barangay}` : ""}, {details.city}
              </p>
            )}
          </div>
        )}

        {/* Coordinates (when a pin is dropped) ride along as hidden fields so the
            server can derive an authoritative tier/zone. Left empty for a
            manual-only save, which gets pinned later at checkout. */}
        <input type="hidden" name="city" value={details?.city ?? ""} readOnly />
        <input type="hidden" name="lat" value={details?.lat ?? ""} readOnly />
        <input type="hidden" name="lng" value={details?.lng ?? ""} readOnly />
        <input
          type="hidden"
          name="googlePlaceId"
          value={details?.googlePlaceId ?? ""}
          readOnly
        />

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55"
          >
            {pending ? "Saving..." : "Add address"}
          </button>
          {state.status === "added" && (
            <span aria-live="polite" className="text-sm text-zb-bone">
              Added.
            </span>
          )}
          {state.status === "error" && (
            <span role="alert" className="text-sm text-zb-danger">
              {state.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
