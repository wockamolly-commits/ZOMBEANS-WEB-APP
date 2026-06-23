import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/login?error=link_disabled", request.url)
  );
}
