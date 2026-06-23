import { type NextRequest, NextResponse } from "next/server";
import { isAdminSurfacePath, safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
