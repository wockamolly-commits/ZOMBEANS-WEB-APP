import { describe, expect, it } from "vitest";
import { resolveClosedUntil } from "@/lib/store-availability";
import { manilaDateAtHour } from "@/lib/checkout";

const now = new Date("2026-06-28T02:00:00Z"); // 10:00 Manila, Sun Jun 28

describe("resolveClosedUntil", () => {
  it("manual returns null", () => {
    expect(resolveClosedUntil({ kind: "manual" }, now)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("today returns tomorrow at opening", () => {
    const r = resolveClosedUntil({ kind: "today" }, now);
    expect(r).toEqual({ ok: true, value: manilaDateAtHour(1, 8, now) });
    expect(r.ok && r.value).toBe("2026-06-29T00:00:00.000Z");
  });

  it("tomorrow returns day-after at opening", () => {
    const r = resolveClosedUntil({ kind: "tomorrow" }, now);
    expect(r.ok && r.value).toBe("2026-06-30T00:00:00.000Z");
  });

  it("preset returns now plus minutes", () => {
    const r = resolveClosedUntil({ kind: "preset", minutes: 120 }, now);
    expect(r.ok && r.value).toBe(
      new Date(now.getTime() + 120 * 60_000).toISOString()
    );
  });

  it("specific future returns that iso", () => {
    const iso = "2026-06-28T05:00:00.000Z";
    expect(resolveClosedUntil({ kind: "specific", iso }, now)).toEqual({
      ok: true,
      value: iso,
    });
  });

  it("specific past returns error", () => {
    const r = resolveClosedUntil(
      { kind: "specific", iso: "2026-06-28T01:00:00.000Z" },
      now
    );
    expect(r.ok).toBe(false);
  });
});

describe("manilaDateAtHour", () => {
  it("builds the right UTC instant", () => {
    expect(manilaDateAtHour(0, 8, now)).toBe("2026-06-28T00:00:00.000Z");
  });
});
