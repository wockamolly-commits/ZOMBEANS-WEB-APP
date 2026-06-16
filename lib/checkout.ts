export type ServiceMode = "dine_in" | "pickup" | "delivery";

export const STORE_OPEN_HOUR = 7;
export const STORE_CLOSE_HOUR = 22;
export const DEFAULT_PREP_MINUTES = 20;
export const PICKUP_SLOT_MINUTES = 15;

export const DELIVERY_TIERS = [
  { value: "tier-2", label: "Up to 2 km", feeCents: 3000 },
  { value: "tier-4", label: "2-4 km", feeCents: 4000 },
  { value: "tier-6", label: "4-6 km", feeCents: 5000 },
] as const;

export function getDeliveryFeeCents(tier: string) {
  return DELIVERY_TIERS.find((entry) => entry.value === tier)?.feeCents ?? 0;
}

export function generatePickupSlots(now = new Date()) {
  const first = new Date(now.getTime() + DEFAULT_PREP_MINUTES * 60_000);
  first.setSeconds(0, 0);
  const minutes = first.getMinutes();
  first.setMinutes(
    Math.ceil(minutes / PICKUP_SLOT_MINUTES) * PICKUP_SLOT_MINUTES
  );

  const close = new Date(now);
  close.setHours(STORE_CLOSE_HOUR, 0, 0, 0);

  if (now.getHours() < STORE_OPEN_HOUR) {
    first.setHours(STORE_OPEN_HOUR, 0, 0, 0);
  }

  const slots: Array<{ value: string; label: string }> = [];
  for (
    const slot = new Date(first);
    slot <= close;
    slot.setMinutes(slot.getMinutes() + PICKUP_SLOT_MINUTES)
  ) {
    slots.push({
      value: slot.toISOString(),
      label: new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      }).format(slot),
    });
  }
  return slots;
}
