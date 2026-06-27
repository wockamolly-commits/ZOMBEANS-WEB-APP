import { type NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { safeNextPath } from "@/lib/safe-next";

const inviteParamsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  invitationId: z.uuid(),
  next: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = inviteParamsSchema.safeParse({
    email: searchParams.get("email"),
    invitationId: searchParams.get("invitationId"),
    next: searchParams.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", request.url)
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("invite", "staff");
  loginUrl.searchParams.set("email", parsed.data.email);
  loginUrl.searchParams.set("invitationId", parsed.data.invitationId);
  loginUrl.searchParams.set("next", safeNextPath(parsed.data.next, "/workspace"));
  loginUrl.hash = "_";

  return NextResponse.redirect(loginUrl);
}
