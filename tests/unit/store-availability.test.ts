import { describe, expect, it } from "vitest";
import {
  clampHighDemandMinutes,
  closureLabel,
  resolveStoreAvailability,
  type StoreAvailabilityRow,
} from "@/lib/store-availability";

const base: StoreAvailabilityRow = {
  accepting_orders: true,
  closure_reason_code: null,
  closure_note: null,
  closed_until: null,
  high_demand: false,
  high_demand_minutes: null,
  high_demand_until: null,
};

const now = new Date("2026-06-27T10:00:00Z");

describe("clampHighDemandMinutes", () => {
  it("clamps below the floor", () => {
    expect(clampHighDemandMinutes(2)).toBe(5);
  });
  it("clamps above the ceiling", () => {
    expect(clampHighDemandMinutes(999)).toBe(60);
  });
  it("passes through in-range values", () => {
    expect(clampHighDemandMinutes(20)).toBe(20);
  });
});

describe("closureLabel", () => {
  it("maps known codes", () => {
    expect(closureLabel("kitchen", null)).toBe("Kitchen unavailable");
  });
  it("uses the note for custom", () => {
    expect(closureLabel("custom", "Burst pipe")).toBe("Burst pipe");
  });
  it("returns null when open", () => {
    expect(closureLabel(null, null)).toBeNull();
  });
});

describe("resolveStoreAvailability", () => {
  it("reports open with no buffer by default", () => {
    const r = resolveStoreAvailability(base, now);
    expect(r.isOpen).toBe(true);
    expect(r.prepBufferMinutes).toBe(0);
    expect(r.highDemand).toBe(false);
  });

  it("reports closed with a resolved label", () => {
    const r = resolveStoreAvailability(
      { ...base, accepting_orders: false, closure_reason_code: "maintenance" },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.closureLabel).toBe("Under maintenance");
  });

  it("auto-reopens when closed_until has passed", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "today",
        closed_until: "2026-06-27T09:00:00Z",
      },
      now
    );
    expect(r.isOpen).toBe(true);
    expect(r.closureLabel).toBeNull();
  });

  it("exposes the high-demand buffer while active", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-27T10:20:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(true);
    expect(r.prepBufferMinutes).toBe(20);
  });

  it("ignores expired high demand", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-27T09:30:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(false);
    expect(r.prepBufferMinutes).toBe(0);
  });
});
