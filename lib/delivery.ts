// Pure delivery distance + fee-tier math. Mirrors the SQL `delivery_quote`
// function (migration 0047): both read the same tier config from app_settings,
// so the only duplicated logic is this stable haversine + tier walk. Used by
// DeliveryMapPicker for an instant optimistic estimate; the server (RPC /
// place_order) stays authoritative for the charged fee.

export type DeliveryTier = { maxKm: number; feeCents: number };

export type DeliveryQuote =
  | { inZone: true; distanceKm: number; tier: string; feeCents: number }
  | { inZone: false; distanceKm: number; tier: null; feeCents: null };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function resolveDeliveryQuote(
  distanceKm: number,
  tiers: DeliveryTier[],
  maxKm: number
): DeliveryQuote {
  const rounded = Math.round(distanceKm * 100) / 100;
  if (rounded > maxKm) {
    return { inZone: false, distanceKm: rounded, tier: null, feeCents: null };
  }

  const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
  const match = sorted.find((t) => rounded <= t.maxKm);
  if (!match) {
    return { inZone: false, distanceKm: rounded, tier: null, feeCents: null };
  }

  return {
    inZone: true,
    distanceKm: rounded,
    tier: `tier-${match.maxKm}`,
    feeCents: match.feeCents,
  };
}
