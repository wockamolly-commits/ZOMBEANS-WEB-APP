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
  physical_open: true,
  physical_closure_reason_code: null,
  physical_closure_note: null,
  physical_closed_until: null,
  high_demand: false,
  high_demand_minutes: null,
  high_demand_until: null,
};

const now = new Date("2026-06-28T10:00:00Z");

describe("clampHighDemandMinutes", () => {
  it("clamps below floor", () => expect(clampHighDemandMinutes(2)).toBe(5));
  it("clamps above ceiling", () => expect(clampHighDemandMinutes(999)).toBe(60));
  it("passes through in range", () => expect(clampHighDemandMinutes(20)).toBe(20));
  it("defaults NaN", () => expect(clampHighDemandMinutes(NaN)).toBe(15));
  it("rounds", () => expect(clampHighDemandMinutes(7.6)).toBe(8));
});

describe("closureLabel", () => {
  it("maps unified codes", () => {
    expect(closureLabel("staff", null)).toBe("Staff unavailable");
    expect(closureLabel("high_volume", null)).toBe("High order volume");
  });

  it("custom uses note, falls back when blank", () => {
    expect(closureLabel("custom", "Burst pipe")).toBe("Burst pipe");
    expect(closureLabel("custom", null)).toBe("Temporarily closed");
  });

  it("null when open", () => expect(closureLabel(null, null)).toBeNull());
});

describe("resolveStoreAvailability", () => {
  it("all open by default", () => {
    const r = resolveStoreAvailability(base, now);
    expect(r.isOpen).toBe(true);
    expect(r.physicalOpen).toBe(true);
    expect(r.onSiteModesDisabled).toBe(false);
    expect(r.prepBufferMinutes).toBe(0);
  });

  it("webstore closed independently of physical", () => {
    const r = resolveStoreAvailability(
      { ...base, accepting_orders: false, closure_reason_code: "maintenance" },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.closureLabel).toBe("Temporary maintenance");
    expect(r.physicalOpen).toBe(true);
    expect(r.onSiteModesDisabled).toBe(false);
  });

  it("physical closed disables on-site modes, webstore stays open", () => {
    const r = resolveStoreAvailability(
      { ...base, physical_open: false, physical_closure_reason_code: "staff" },
      now
    );
    expect(r.physicalOpen).toBe(false);
    expect(r.physicalLabel).toBe("Staff unavailable");
    expect(r.onSiteModesDisabled).toBe(true);
    expect(r.isOpen).toBe(true);
  });

  it("both closed", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "emergency",
        physical_open: false,
        physical_closure_reason_code: "emergency",
      },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.physicalOpen).toBe(false);
  });

  it("auto-reopens each service when its until passes", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "high_volume",
        closed_until: "2026-06-28T09:00:00Z",
        physical_open: false,
        physical_closure_reason_code: "staff",
        physical_closed_until: "2026-06-28T11:00:00Z",
      },
      now
    );
    expect(r.isOpen).toBe(true);
    expect(r.physicalOpen).toBe(false);
  });

  it("high demand independent and buffer reported while active", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-28T10:20:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(true);
    expect(r.prepBufferMinutes).toBe(20);
  });
});
