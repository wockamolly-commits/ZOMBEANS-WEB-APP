import { beforeEach, describe, expect, it, vi } from "vitest";

// The /auth/signout GET handler has a side effect (it clears the auth cookie).
// Next.js prefetches <Link> hrefs in production, so a logged-in customer's
// "Not you?" link to /auth/signout could be fetched speculatively and sign them
// out without any click. The handler must ignore prefetch/speculative GETs and
// only sign out on a real navigation.

const customerSignOut = vi.fn(async () => ({ error: null }));
const adminSignOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut: customerSignOut } })),
}));
vi.mock("@/lib/supabase/admin-session", () => ({
  createAdminSessionClient: vi.fn(async () => ({ auth: { signOut: adminSignOut } })),
}));

const redirect = vi.fn((url: URL) => ({ kind: "redirect", url: url.toString() }));
vi.mock("next/server", () => ({
  NextResponse: Object.assign(
    class {
      status: number;
      constructor(_body: unknown, init?: { status?: number }) {
        this.status = init?.status ?? 200;
      }
    },
    { redirect }
  ),
}));

function makeRequest(
  url: string,
  headers: Record<string, string> = {}
) {
  return {
    url,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Parameters<typeof import("@/app/auth/signout/route").GET>[0];
}

describe("/auth/signout GET", () => {
  beforeEach(() => {
    vi.resetModules();
    customerSignOut.mockClear();
    adminSignOut.mockClear();
    redirect.mockClear();
  });

  it("signs out on a real navigation", async () => {
    const { GET } = await import("@/app/auth/signout/route");

    await GET(makeRequest("https://zombeans.xyz/auth/signout?next=/checkout"));

    expect(customerSignOut).toHaveBeenCalledTimes(1);
  });

  it("does NOT sign out for a Next.js Link prefetch", async () => {
    const { GET } = await import("@/app/auth/signout/route");

    const res = await GET(
      makeRequest("https://zombeans.xyz/auth/signout?next=/checkout", {
        "next-router-prefetch": "1",
        rsc: "1",
      })
    );

    expect(customerSignOut).not.toHaveBeenCalled();
    // It must respond harmlessly without clearing cookies (no redirect that
    // would carry the cleared-cookie side effect).
    expect((res as { status?: number }).status).toBe(204);
  });

  it("does NOT sign out for a browser speculative (Sec-Purpose) prefetch", async () => {
    const { GET } = await import("@/app/auth/signout/route");

    await GET(
      makeRequest("https://zombeans.xyz/auth/signout", {
        "sec-purpose": "prefetch;prerender",
      })
    );

    expect(customerSignOut).not.toHaveBeenCalled();
  });
});
