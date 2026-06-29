import { beforeEach, describe, expect, it, vi } from "vitest";

// The proxy (Next 16's renamed middleware) is the ONE place allowed to refresh
// the customer's Supabase session and persist the rotated token back to the
// browser. These tests pin that contract: a request carrying a customer auth
// cookie must trigger a customer-scoped refresh whose new cookies land on the
// response, while the admin session stays isolated in its own cookie + compact
// "tokens-only" encoding.

type CookieAdapter = {
  encode?: string;
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options?: unknown }[],
    headers: Record<string, string>
  ) => void;
};

type ClientOptions = {
  cookieOptions?: { name?: string };
  cookies: CookieAdapter;
};

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));

// Each created client, when getUser() runs, simulates Supabase rotating an
// expired access token: it writes a fresh cookie through the adapter's setAll,
// exactly as @supabase/ssr does on TOKEN_REFRESHED.
const createServerClient = vi.fn((_url: string, _key: string, options: ClientOptions) => ({
  options,
  auth: {
    getUser: async () => {
      const cookieName = options.cookieOptions?.name ?? "sb-example-auth-token";
      options.cookies.setAll(
        [{ name: cookieName, value: "rotated", options: { path: "/" } }],
        { "x-refreshed": cookieName }
      );
      return getUser();
    },
  },
}));

const responseCookies = new Map<string, { value: string; options: unknown }>();
const responseHeaders = new Map<string, string>();

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/server", () => ({
  NextResponse: {
    next: () => ({
      cookies: {
        set: (name: string, value: string, options: unknown) =>
          responseCookies.set(name, { value, options }),
      },
      headers: { set: (name: string, value: string) => responseHeaders.set(name, value) },
    }),
  },
}));

function makeRequest(cookies: { name: string; value: string }[]) {
  return {
    cookies: {
      getAll: () => cookies,
      set: vi.fn(),
    },
  } as unknown as Parameters<
    typeof import("@/lib/supabase/proxy").updateSession
  >[0];
}

describe("supabase proxy session refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClient.mockClear();
    getUser.mockClear();
    responseCookies.clear();
    responseHeaders.clear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("refreshes the customer session and writes the rotated cookie to the response", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    await updateSession(
      makeRequest([{ name: "sb-example-auth-token", value: "stale" }])
    );

    // A customer-scoped client must be created. It must NOT use the admin's
    // compact "tokens-only" encoding, or the browser (which wrote a base64url
    // full-session cookie) won't be able to read what the proxy writes back.
    const customerCall = createServerClient.mock.calls.find(
      ([, , options]) => (options as ClientOptions).cookieOptions?.name === undefined
    );
    expect(customerCall).toBeDefined();
    expect((customerCall![2] as ClientOptions).cookies.encode).toBeUndefined();

    // The refresh actually ran and its rotated cookie reached the browser.
    expect(getUser).toHaveBeenCalled();
    expect(responseCookies.get("sb-example-auth-token")).toEqual({
      value: "rotated",
      options: { path: "/" },
    });
  });

  it("refreshes the admin session in its isolated cookie with tokens-only encoding", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    await updateSession(makeRequest([{ name: "zb-admin-auth", value: "stale" }]));

    const adminCall = createServerClient.mock.calls.find(
      ([, , options]) =>
        (options as ClientOptions).cookieOptions?.name === "zb-admin-auth"
    );
    expect(adminCall).toBeDefined();
    expect((adminCall![2] as ClientOptions).cookies.encode).toBe("tokens-only");
    expect(responseCookies.get("zb-admin-auth")).toEqual({
      value: "rotated",
      options: { path: "/" },
    });
  });

  it("does no auth work for anonymous requests carrying no session cookies", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    await updateSession(makeRequest([{ name: "cart", value: "x" }]));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});
