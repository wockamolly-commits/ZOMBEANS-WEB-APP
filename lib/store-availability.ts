import { manilaDateAtHour, STORE_OPEN_HOUR } from "@/lib/checkout";

export const HIGH_DEMAND_MIN_MINUTES = 5;
export const HIGH_DEMAND_MAX_MINUTES = 60;
export const HIGH_DEMAND_STEP_MINUTES = 5;
export const HIGH_DEMAND_DEFAULT_MINUTES = 15;
export const HIGH_DEMAND_WINDOW_MINUTES = 30;

export type ClosureReasonCode =
  | "end_of_hours"
  | "maintenance"
  | "staff"
  | "inventory"
  | "emergency"
  | "high_volume"
  | "custom";

export const REASON_CODES: ClosureReasonCode[] = [
  "end_of_hours",
  "maintenance",
  "staff",
  "inventory",
  "emergency",
  "high_volume",
  "custom",
];

const CLOSURE_LABELS: Record<ClosureReasonCode, string> = {
  end_of_hours: "End of operating hours",
  maintenance: "Temporary maintenance",
  staff: "Staff unavailable",
  inventory: "Inventory shortage",
  emergency: "Emergency issue",
  high_volume: "High order volume",
  custom: "Temporarily closed",
};

export type DurationChoice =
  | { kind: "manual" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "preset"; minutes: 30 | 60 | 120 | 240 }
  | { kind: "specific"; iso: string };

export function resolveClosedUntil(
  choice: DurationChoice,
  now: Date = new Date()
): { ok: true; value: string | null } | { ok: false; error: string } {
  switch (choice.kind) {
    case "manual":
      return { ok: true, value: null };
    case "today":
      return { ok: true, value: manilaDateAtHour(1, STORE_OPEN_HOUR, now) };
    case "tomorrow":
      return { ok: true, value: manilaDateAtHour(2, STORE_OPEN_HOUR, now) };
    case "preset":
      return {
        ok: true,
        value: new Date(now.getTime() + choice.minutes * 60_000).toISOString(),
      };
    case "specific": {
      const t = new Date(choice.iso).getTime();
      if (Number.isNaN(t) || t <= now.getTime()) {
        return { ok: false, error: "Choose a future date and time." };
      }
      return { ok: true, value: choice.iso };
    }
  }
}

export type StoreAvailabilityRow = {
  accepting_orders: boolean;
  closure_reason_code: ClosureReasonCode | null;
  closure_note: string | null;
  closed_until: string | null;
  physical_open?: boolean;
  physical_closure_reason_code?: ClosureReasonCode | null;
  physical_closure_note?: string | null;
  physical_closed_until?: string | null;
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
  physicalOpen: boolean;
  physicalReasonCode: ClosureReasonCode | null;
  physicalLabel: string | null;
  physicalNote: string | null;
  physicalClosedUntil: string | null;
  onSiteModesDisabled: boolean;
  highDemand: boolean;
  highDemandUntil: string | null;
  prepBufferMinutes: number;
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

function isPast(iso: string | null | undefined, now: Date): boolean {
  return iso != null && new Date(iso).getTime() <= now.getTime();
}

function resolveService(
  open: boolean | undefined,
  reasonCode: ClosureReasonCode | null | undefined,
  note: string | null | undefined,
  until: string | null | undefined,
  now: Date
) {
  const reopened = open === false && isPast(until, now);
  const isOpen = open !== false || reopened;
  const closed = !isOpen;
  const code = closed ? reasonCode ?? null : null;
  return {
    isOpen,
    reasonCode: code,
    label: closureLabel(code, note ?? null),
    note: closed ? note ?? null : null,
    closedUntil: closed ? until ?? null : null,
  };
}

export function resolveStoreAvailability(
  row: StoreAvailabilityRow,
  now: Date = new Date()
): StoreAvailability {
  const web = resolveService(
    row.accepting_orders,
    row.closure_reason_code,
    row.closure_note,
    row.closed_until,
    now
  );
  const phys = resolveService(
    row.physical_open,
    row.physical_closure_reason_code,
    row.physical_closure_note,
    row.physical_closed_until,
    now
  );

  const highDemandActive =
    row.high_demand && !isPast(row.high_demand_until, now);

  return {
    isOpen: web.isOpen,
    closureReasonCode: web.reasonCode,
    closureLabel: web.label,
    closureNote: web.note,
    closedUntil: web.closedUntil,
    physicalOpen: phys.isOpen,
    physicalReasonCode: phys.reasonCode,
    physicalLabel: phys.label,
    physicalNote: phys.note,
    physicalClosedUntil: phys.closedUntil,
    onSiteModesDisabled: !phys.isOpen,
    highDemand: highDemandActive,
    highDemandUntil: highDemandActive ? row.high_demand_until : null,
    prepBufferMinutes: highDemandActive ? row.high_demand_minutes ?? 0 : 0,
  };
}
