import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import * as z from "zod";
import { getStaffProfile } from "@/lib/admin";
import {
  consumePasskeyChallenge,
  passkeyCookieOptions,
  PASSKEY_COOKIE,
  webAuthnConfig,
} from "@/lib/passkeys";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  response: z.custom<RegistrationResponseJSON>(),
  label: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const browserToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PASSKEY_COOKIE}=`))
    ?.slice(PASSKEY_COOKIE.length + 1);

  if (!parsed.success || !browserToken) {
    return NextResponse.json({ error: "Passkey request expired." }, { status: 400 });
  }

  try {
    const [profile, supabase] = await Promise.all([
      getStaffProfile(),
      createClient(),
    ]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!profile || !user?.email) {
      return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
    }

    const challenge = await consumePasskeyChallenge(
      decodeURIComponent(browserToken),
      "registration"
    );
    if (!challenge || challenge.profile_id !== profile.id) {
      return NextResponse.json({ error: "Passkey request expired." }, { status: 400 });
    }

    const { origin, rpID } = webAuthnConfig(request);
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo.userVerified) {
      return NextResponse.json({ error: "Passkey enrollment failed." }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    const admin = createAdminClient();
    const { error } = await admin.from("staff_passkeys").insert({
      profile_id: profile.id,
      email: user.email.toLowerCase(),
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: credential.transports ?? [],
      label: parsed.data.label || "Passkey",
    });
    if (error) throw error;

    const response = NextResponse.json({ ok: true });
    response.cookies.set(PASSKEY_COOKIE, "", {
      ...passkeyCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[passkey] registration verification failed:", error);
    return NextResponse.json(
      { error: "Passkey enrollment failed. Try again." },
      { status: 400 }
    );
  }
}