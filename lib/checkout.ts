export type ServiceMode = "dine_in" | "take_out" | "pickup" | "delivery";

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

export type PickupSlot = { value: string; label: string; special?: boolean };

const slotFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});

// Slots are derived from `now`, so calling this repeatedly (e.g. on an
// interval) keeps the list pruned to genuinely upcoming pickup times.
export function generatePickupSlots(now = new Date()): PickupSlot[] {
  // Earliest valid pickup honours the prep estimate; the grid then rounds
  // up to the next slot boundary.
  const earliest = new Date(now.getTime() + DEFAULT_PREP_MINUTES * 60_000);
  earliest.setSeconds(0, 0);

  const first = new Date(earliest);
  first.setMinutes(
    Math.ceil(first.getMinutes() / PICKUP_SLOT_MINUTES) * PICKUP_SLOT_MINUTES
  );

  const close = new Date(now);
  close.setHours(STORE_CLOSE_HOUR, 0, 0, 0);

  if (now.getHours() < STORE_OPEN_HOUR) {
    const open = new Date(now);
    open.setHours(STORE_OPEN_HOUR, 0, 0, 0);
    first.setTime(open.getTime());
    earliest.setTime(open.getTime());
  }

  const slots: PickupSlot[] = [];
  for (
    const slot = new Date(first);
    slot <= close;
    slot.setMinutes(slot.getMinutes() + PICKUP_SLOT_MINUTES)
  ) {
    slots.push({ value: slot.toISOString(), label: slotFormatter.format(slot) });
  }

  // 🌿 A playful 4:20 PM slot — off the regular 15-minute grid, shown only
  // when it's still a valid upcoming pickup (enough prep time, before close).
  const fourTwenty = new Date(now);
  fourTwenty.setHours(16, 20, 0, 0);
  if (fourTwenty >= earliest && fourTwenty <= close) {
    slots.push({
      value: fourTwenty.toISOString(),
      label: slotFormatter.format(fourTwenty),
      special: true,
    });
    slots.sort((a, b) => a.value.localeCompare(b.value));
  }

  return slots;
}
