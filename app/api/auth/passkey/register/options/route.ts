import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import {
  createPasskeyChallenge,
  getPasskeysForProfile,
  passkeyCookieOptions,
  PASSKEY_COOKIE,
  webAuthnConfig,
} from "@/lib/passkeys";
import { getStaffProfile } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

    const passkeys = await getPasskeysForProfile(profile.id);
    const { rpID, rpName } = webAuthnConfig(request);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(profile.id, "utf8")),
      userName: user.email,
      userDisplayName: profile.display_name,
      attestationType: "none",
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60_000,
    });
    const browserToken = await createPasskeyChallenge({
      profileId: profile.id,
      purpose: "registration",
      challenge: options.challenge,
    });

    const response = NextResponse.json({ options });
    response.cookies.set(PASSKEY_COOKIE, browserToken, passkeyCookieOptions());
    return response;
  } catch (error) {
    console.error("[passkey] registration options failed:", error);
    return NextResponse.json(
      { error: "Could not start passkey enrollment." },
      { status: 500 }
    );
  }
}