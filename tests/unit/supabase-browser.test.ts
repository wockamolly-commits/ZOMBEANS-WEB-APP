import { beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn((url, key, options) => ({
  key,
  options,
  url,
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

describe("supabase browser clients", () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("keeps customer and admin auth cookie namespaces separate", async () => {
    const { createAdminClient, createClient } = await import(
      "@/lib/supabase/browser"
    );

    const admin = createAdminClient();
    const customer = createClient();

    expect(admin).not.toBe(customer);
    expect(createBrowserClient).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co",
      "anon-key",
      { cookieOptions: { name: "zb-admin-auth" }, isSingleton: false }
    );
    expect(createBrowserClient).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co",
      "anon-key",
      { isSingleton: false }
    );
  });

  it("reuses each local client without using the package-wide singleton", async () => {
    const { createAdminClient, createClient } = await import(
      "@/lib/supabase/browser"
    );

    expect(createClient()).toBe(createClient());
    expect(createAdminClient()).toBe(createAdminClient());
    expect(createBrowserClient).toHaveBeenCalledTimes(2);
  });
});
