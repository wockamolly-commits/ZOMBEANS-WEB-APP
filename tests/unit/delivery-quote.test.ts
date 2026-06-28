import { describe, expect, it } from "vitest";
import {
  haversineKm,
  resolveDeliveryQuote,
  type DeliveryTier,
} from "@/lib/delivery";

const tiers: DeliveryTier[] = [
  { maxKm: 2, feeCents: 3000 },
  { maxKm: 4, feeCents: 4000 },
  { maxKm: 6, feeCents: 5000 },
];

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(10.5, 123.4, 10.5, 123.4)).toBe(0);
  });

  it("is about 111 km for one degree of latitude", () => {
    expect(haversineKm(10, 123, 11, 123)).toBeGreaterThan(110);
    expect(haversineKm(10, 123, 11, 123)).toBeLessThan(112);
  });
});

describe("resolveDeliveryQuote", () => {
  it("picks the first tier at and below its cap", () => {
    expect(resolveDeliveryQuote(0, tiers, 6)).toMatchObject({
      inZone: true,
      tier: "tier-2",
      feeCents: 3000,
    });
    expect(resolveDeliveryQuote(2, tiers, 6)).toMatchObject({
      tier: "tier-2",
      feeCents: 3000,
    });
    expect(resolveDeliveryQuote(2.01, tiers, 6)).toMatchObject({
      tier: "tier-4",
      feeCents: 4000,
    });
    expect(resolveDeliveryQuote(4, tiers, 6)).toMatchObject({
      tier: "tier-4",
      feeCents: 4000,
    });
    expect(resolveDeliveryQuote(5.9, tiers, 6)).toMatchObject({
      tier: "tier-6",
      feeCents: 5000,
    });
    expect(resolveDeliveryQuote(6, tiers, 6)).toMatchObject({
      tier: "tier-6",
      feeCents: 5000,
    });
  });

  it("is out of zone past the cutoff", () => {
    expect(resolveDeliveryQuote(6.01, tiers, 6)).toEqual({
      inZone: false,
      distanceKm: 6.01,
      tier: null,
      feeCents: null,
    });
  });
});
