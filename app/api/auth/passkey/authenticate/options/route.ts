import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import * as z from "zod";
import {
  createPasskeyChallenge,
  getPasskeysForProfile,
  passkeyCookieOptions,
  PASSKEY_COOKIE,
  resolveActiveOperationsEmail,
  webAuthnConfig,
} from "@/lib/passkeys";

const schema = z.object({
  email: z.email().trim(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const identity = await resolveActiveOperationsEmail(parsed.data.email);
    if (!identity) return NextResponse.json({ staff: false });

    const passkeys = await getPasskeysForProfile(identity.id);
    if (passkeys.length === 0) {
      return NextResponse.json({ staff: true, enrolled: false });
    }

    const { rpID } = webAuthnConfig(request);
    const options = await generateAuthenticationOptions({
      rpID,

      userVerification: "required",
      timeout: 60_000,
    });
    const browserToken = await createPasskeyChallenge({
      profileId: identity.id,
      purpose: "authentication",
      challenge: options.challenge,
    });

    const response = NextResponse.json({
      staff: true,
      enrolled: true,
      options,
    });
    response.cookies.set(PASSKEY_COOKIE, browserToken, passkeyCookieOptions());
    return response;
  } catch (error) {
    console.error("[passkey] authentication options failed:", error);
    const configurationError =
      error instanceof Error &&
      error.message === "Supabase server secret is not configured.";
    return NextResponse.json(
      {
        error: configurationError
          ? "Staff passkey sign-in is not configured yet."
          : "Could not start passkey sign-in. Try again.",
        code: configurationError ? "PASSKEY_NOT_CONFIGURED" : "PASSKEY_START_FAILED",
      },
      { status: configurationError ? 503 : 500 }
    );
  }
}