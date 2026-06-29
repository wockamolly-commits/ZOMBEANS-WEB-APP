import { type NextRequest, NextResponse } from "next/server";
import { isAdminSurfacePath, safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Sign-out has a side effect (clearing the auth cookie), but it's a GET, and
  // Next.js prefetches <Link> hrefs in production (not in dev). A logged-in
  // customer's "Not you?" link to /auth/signout would therefore be fetched
  // speculatively and silently sign them out — the production-only checkout
  // sign-out. Never run the side effect for a prefetch/speculative request;
  // only a real navigation should sign out.
  if (isPrefetch(request)) {
    return new NextResponse(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const adminScope = searchParams.get("scope") === "admin";
  const requestedNext = safeNextPath(searchParams.get("next"), "/");
  const next =
    adminScope && isAdminSurfacePath(requestedNext) ? "/" : requestedNext;
  const supabase = adminScope
    ? await createAdminSessionClient()
    : await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(next, request.url));
}

// True for Next.js Link prefetches and browser speculative prefetch/prerender,
// none of which represent a user intent to sign out.
function isPrefetch(request: NextRequest): boolean {
  const headers = request.headers;
  if (headers.get("next-router-prefetch") === "1") return true;
  if (headers.get("purpose") === "prefetch") return true;
  const secPurpose = headers.get("sec-purpose") ?? "";
  return secPurpose.includes("prefetch") || secPurpose.includes("prerender");
}
