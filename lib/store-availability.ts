export const HIGH_DEMAND_MIN_MINUTES = 5;
export const HIGH_DEMAND_MAX_MINUTES = 60;
export const HIGH_DEMAND_STEP_MINUTES = 5;
export const HIGH_DEMAND_DEFAULT_MINUTES = 15;
export const HIGH_DEMAND_WINDOW_MINUTES = 30;

export type ClosureReasonCode =
  | "today"
  | "temporary"
  | "kitchen"
  | "inventory"
  | "maintenance"
  | "custom";

export type StoreAvailabilityRow = {
  accepting_orders: boolean;
  closure_reason_code: ClosureReasonCode | null;
  closure_note: string | null;
  closed_until: string | null;
  high_demand: boolean;
  high_demand_minutes: number | null;
  high_demand_until: string | null;
};

export type StoreAvailability = {
  isOpen: boolean;
  closureReasonCode: ClosureReasonCode | null;
  closureLabel: string | null;
  closureNote: string | null;
  closedUntil: string | null;
  highDemand: boolean;
  highDemandUntil: string | null;
  prepBufferMinutes: number;
};

const CLOSURE_LABELS: Record<ClosureReasonCode, string> = {
  today: "Unavailable for today",
  temporary: "Temporarily closed",
  kitchen: "Kitchen unavailable",
  inventory: "Inventory shortage",
  maintenance: "Under maintenance",
  custom: "Temporarily closed",
};

export function clampHighDemandMinutes(value: number): number {
  if (Number.isNaN(value)) return HIGH_DEMAND_DEFAULT_MINUTES;
  return Math.min(
    HIGH_DEMAND_MAX_MINUTES,
    Math.max(HIGH_DEMAND_MIN_MINUTES, Math.round(value))
  );
}

export function closureLabel(
  code: ClosureReasonCode | null,
  note: string | null
): string | null {
  if (!code) return null;
  if (code === "custom") return note?.trim() || CLOSURE_LABELS.custom;
  return CLOSURE_LABELS[code];
}

function isPast(iso: string | null, now: Date): boolean {
  return iso !== null && new Date(iso).getTime() <= now.getTime();
}

export function resolveStoreAvailability(
  row: StoreAvailabilityRow,
  now: Date = new Date()
): StoreAvailability {
  // Mirror the DB refresh in-memory so the UI is correct before the next read.
  const reopened = !row.accepting_orders && isPast(row.closed_until, now);
  const isOpen = row.accepting_orders || reopened;

  const closed = !isOpen;
  const reasonCode = closed ? row.closure_reason_code : null;

  const highDemandActive =
    row.high_demand && !isPast(row.high_demand_until, now);
  const prepBufferMinutes = highDemandActive
    ? row.high_demand_minutes ?? 0
    : 0;

  return {
    isOpen,
    closureReasonCode: reasonCode,
    closureLabel: closureLabel(reasonCode, row.closure_note),
    closureNote: closed ? row.closure_note : null,
    closedUntil: closed ? row.closed_until : null,
    highDemand: highDemandActive,
    highDemandUntil: highDemandActive ? row.high_demand_until : null,
    prepBufferMinutes,
  };
}
