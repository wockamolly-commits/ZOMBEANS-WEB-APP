import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the cookies adapter handed to createServerClient so we can assert how
// each server client is allowed to interact with the cookie store.
const createServerClient = vi.fn(
  (url: string, key: string, options: { cookies: unknown }) => ({
    key,
    options,
    url,
  })
);

const cookieStore = {
  getAll: vi.fn(() => [{ name: "sb-x-auth-token", value: "abc" }]),
  set: vi.fn(),
};

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

type CookieMethods = {
  getAll: () => unknown;
  setAll: (
    cookies: { name: string; value: string; options?: unknown }[]
  ) => void;
};

describe("supabase server clients", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClient.mockClear();
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("read-only client can read cookies but never writes or clears them", async () => {
    const { createReadOnlyClient } = await import("@/lib/supabase/server");

    await createReadOnlyClient();

    const { cookies } = createServerClient.mock.calls[0][2] as {
      cookies: CookieMethods;
    };

    // Reading the session must still work.
    expect(cookies.getAll()).toEqual([
      { name: "sb-x-auth-token", value: "abc" },
    ]);

    // Writing/clearing must be inert: this is what prevents a failed server-side
    // token refresh from signing the customer out during checkout.
    cookies.setAll([
      { name: "sb-x-auth-token", value: "", options: { maxAge: 0 } },
    ]);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("default client forwards cookie writes to the store", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    await createClient();

    const { cookies } = createServerClient.mock.calls[0][2] as {
      cookies: CookieMethods;
    };

    cookies.setAll([
      { name: "sb-x-auth-token", value: "new", options: { path: "/" } },
    ]);
    expect(cookieStore.set).toHaveBeenCalledWith("sb-x-auth-token", "new", {
      path: "/",
    });
  });
});
