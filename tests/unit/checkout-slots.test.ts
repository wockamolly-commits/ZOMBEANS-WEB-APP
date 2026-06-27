import { describe, expect, it } from "vitest";
import { generatePickupSlots } from "@/lib/checkout";

// A weekday mid-morning Manila time well inside operating hours.
const now = new Date("2026-06-29T03:00:00Z"); // 11:00 Manila

describe("generatePickupSlots extra prep buffer", () => {
  it("pushes the earliest slot later when a buffer is supplied", () => {
    const base = generatePickupSlots(now, 0);
    const buffered = generatePickupSlots(now, 30);
    expect(base.length).toBeGreaterThan(0);
    expect(buffered.length).toBeGreaterThan(0);
    expect(new Date(buffered[0].value).getTime()).toBeGreaterThan(
      new Date(base[0].value).getTime()
    );
  });

  it("defaults the buffer to zero", () => {
    const a = generatePickupSlots(now);
    const b = generatePickupSlots(now, 0);
    expect(a[0]?.value).toBe(b[0]?.value);
  });
});
