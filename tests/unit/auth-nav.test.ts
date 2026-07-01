import { describe, expect, it } from "vitest";
import { resolveAuthNavState } from "@/lib/auth-nav";

describe("resolveAuthNavState", () => {
  it("links operations users back to the workspace", () => {
    expect(
      resolveAuthNavState({
        operationsProfile: { display_name: "Sam Admin" },
        riderProfile: null,
        hasCustomerUser: false,
      })
    ).toEqual({
      href: "/workspace",
      label: "Dashboard",
      ariaLabel: "Dashboard: Sam Admin",
    });
  });

  it("links rider users back to the rider dashboard", () => {
    expect(
      resolveAuthNavState({
        operationsProfile: null,
        riderProfile: { display_name: "Rhea Rider" },
        hasCustomerUser: false,
      })
    ).toEqual({
      href: "/rider",
      label: "Rider",
      ariaLabel: "Rider dashboard: Rhea Rider",
    });
  });

  it("links customer users to their account", () => {
    expect(
      resolveAuthNavState({
        operationsProfile: null,
        riderProfile: null,
        hasCustomerUser: true,
      })
    ).toEqual({
      href: "/account",
      label: "Account",
      ariaLabel: "Account",
    });
  });

  it("shows sign in only for guests", () => {
    expect(
      resolveAuthNavState({
        operationsProfile: null,
        riderProfile: null,
        hasCustomerUser: false,
      })
    ).toEqual({
      href: "/login",
      label: "Sign in",
      ariaLabel: "Sign in",
    });
  });
});
