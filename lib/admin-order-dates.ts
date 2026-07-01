const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = {
  startISO: string;
  endISO: string;
};

export function recentOrdersSinceISO(now = new Date()): string {
  return new Date(now.getTime() - 2 * DAY_MS).toISOString();
}

// Start of the current Manila calendar day, returned as a UTC ISO string.
export function manilaTodayStartISO(now = new Date()): string {
  const ph = new Date(now.getTime() + MANILA_OFFSET_MS);
  const midnightUtc =
    Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()) -
    MANILA_OFFSET_MS;
  return new Date(midnightUtc).toISOString();
}

export function manilaDateInputValue(now = new Date()): string {
  const ph = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = ph.getUTCFullYear();
  const month = String(ph.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ph.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function manilaDateRangeISO(value: string): DateRange | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = Date.UTC(year, monthIndex, day) - MANILA_OFFSET_MS;
  const normalized = new Date(start + MANILA_OFFSET_MS);

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== monthIndex ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    startISO: new Date(start).toISOString(),
    endISO: new Date(start + DAY_MS).toISOString(),
  };
}
