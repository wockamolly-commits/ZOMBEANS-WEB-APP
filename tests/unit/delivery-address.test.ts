import { describe, expect, it } from "vitest";
import {
  formatSubmittedDeliveryAddress,
  formatDeliveryAddress,
} from "@/lib/delivery-address";

describe("delivery address formatting", () => {
  it("keeps the customer submitted saved/manual address as the primary label", () => {
    expect(
      formatSubmittedDeliveryAddress({
        street: "Blk 1 Lot 2, Nangka St",
        barangay: "Barangay 2",
        city: "San Carlos City",
        detected_address: "GPS reverse geocode",
        lat: 10.1234567,
        lng: 123.7654321,
      })
    ).toBe("Blk 1 Lot 2, Nangka St, Barangay 2, San Carlos City");
  });

  it("falls back to detected address for incomplete legacy submitted rows", () => {
    expect(
      formatSubmittedDeliveryAddress({
        street: "",
        barangay: null,
        city: "San Carlos City",
        detected_address: "Detected Pin, San Carlos City",
        lat: 10.1234567,
        lng: 123.7654321,
      })
    ).toBe("Detected Pin, San Carlos City");
  });

  it("falls back to delivery coordinates when no address text is available", () => {
    expect(
      formatSubmittedDeliveryAddress({
        street: "",
        city: "San Carlos City",
        lat: 10.1234567,
        lng: 123.7654321,
      })
    ).toBe("10.123457, 123.765432");
  });

  it("preserves the generic formatter for callers that want city-only output", () => {
    expect(formatDeliveryAddress({ street: "", city: "San Carlos City" })).toBe(
      "San Carlos City"
    );
  });
});
