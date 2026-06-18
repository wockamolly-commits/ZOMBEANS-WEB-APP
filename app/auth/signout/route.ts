import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"), "/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(next, request.url));
}
