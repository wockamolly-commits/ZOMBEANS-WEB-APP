export type ServiceMode = "dine_in" | "take_out" | "pickup" | "delivery";

// Operating hours (Asia/Manila). The café opens at the same time every day
// but closes an hour later on weekends.
export const STORE_OPEN_HOUR = 8; // 8:00 AM
export const STORE_CLOSE_WEEKDAY_HOUR = 20; // 8:00 PM, Mon–Fri
export const STORE_CLOSE_WEEKEND_HOUR = 21; // 9:00 PM, Sat–Sun
export const DEFAULT_PREP_MINUTES = 20;
export const PICKUP_SLOT_MINUTES = 15;
// How long before closing time we start warning customers that the kitchen is
// about to stop taking orders (e.g. 7:45 PM for an 8:00 PM close).
export const KITCHEN_CLOSING_SOON_MINUTES = 15;

const MANILA_TZ = "Asia/Manila";

function isDevelopmentStoreOverrideEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_FORCE_STORE_OPEN === "true"
  );
}

// A short, human-readable summary of the weekly schedule for display.
export const STORE_HOURS_SUMMARY = [
  { days: "Mon–Fri", hours: "8:00 AM – 8:00 PM" },
  { days: "Sat–Sun", hours: "8:00 AM – 9:00 PM" },
] as const;

// Closing hour for a given day-of-week (0 = Sunday … 6 = Saturday).
export function getCloseHour(day: number): number {
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? STORE_CLOSE_WEEKEND_HOUR : STORE_CLOSE_WEEKDAY_HOUR;
}

// End of today's operating window in Asia/Manila, as a UTC ISO string.
// Manila has no DST (UTC+8), so a fixed offset is safe for the conversion.
export function endOfSlotISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const closeHour = getCloseHour(dayMap[get("weekday")] ?? now.getDay());
  const iso = `${get("year")}-${get("month")}-${get("day")}T${String(
    closeHour
  ).padStart(2, "0")}:00:00+08:00`;
  return new Date(iso).toISOString();
}

// A Manila wall-clock instant at `hour:00` on (today + dayOffset), as a UTC ISO
// string. Manila has no DST (UTC+8), so day arithmetic on the midnight instant
// is exact. dayOffset 1 = tomorrow, 2 = day after.
export function manilaDateAtHour(
  dayOffset: number,
  hour: number,
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const manilaMidnightToday = new Date(
    `${get("year")}-${get("month")}-${get("day")}T00:00:00+08:00`
  ).getTime();
  return new Date(
    manilaMidnightToday + (dayOffset * 24 + hour) * 3_600_000
  ).toISOString();
}

// Resolve the current wall-clock in Manila regardless of the runtime's own
// timezone, so the open/closed decision is identical on the server and in the
// browser of an overseas customer.
function manilaNow(date: Date): { day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    day: dayMap[get("weekday")] ?? date.getDay(),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

// True while the café is within today's operating window (open inclusive,
// close exclusive — e.g. ordering stops the moment the clock hits closing).
export function isStoreOpen(date = new Date()): boolean {
  if (isDevelopmentStoreOverrideEnabled()) return true;
  const { day, hour } = manilaNow(date);
  return hour >= STORE_OPEN_HOUR && hour < getCloseHour(day);
}

// Whole minutes left until today's closing time, or null when the café isn't
// currently open (before opening, or already closed). Minute-accurate, so it
// can drive a live countdown near closing.
export function minutesUntilClose(date = new Date()): number | null {
  if (isDevelopmentStoreOverrideEnabled()) return null;
  const { day, hour, minute } = manilaNow(date);
  if (hour < STORE_OPEN_HOUR) return null;
  const remaining = getCloseHour(day) * 60 - (hour * 60 + minute);
  return remaining > 0 ? remaining : null;
}

// True only during the final window before close (the last
// KITCHEN_CLOSING_SOON_MINUTES the café is open). Flips to false the moment the
// café closes — by then ordering is already blocked by isStoreOpen().
export function isKitchenClosingSoon(date = new Date()): boolean {
  const remaining = minutesUntilClose(date);
  return remaining !== null && remaining <= KITCHEN_CLOSING_SOON_MINUTES;
}

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
export function generatePickupSlots(
  now = new Date(),
  extraPrepMinutes = 0
): PickupSlot[] {
  // Earliest valid pickup honours the prep estimate (plus any high-demand
  // buffer); the grid then rounds up to the next slot boundary.
  const earliest = new Date(
    now.getTime() + (DEFAULT_PREP_MINUTES + extraPrepMinutes) * 60_000
  );
  earliest.setSeconds(0, 0);

  const first = new Date(earliest);
  first.setMinutes(
    Math.ceil(first.getMinutes() / PICKUP_SLOT_MINUTES) * PICKUP_SLOT_MINUTES
  );

  const overrideOpen = isDevelopmentStoreOverrideEnabled();
  const close = overrideOpen
    ? new Date(now.getTime() + 4 * 60 * 60 * 1000)
    : new Date(now);
  if (!overrideOpen) {
    close.setHours(getCloseHour(now.getDay()), 0, 0, 0);
  }

  if (!overrideOpen && now.getHours() < STORE_OPEN_HOUR) {
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
