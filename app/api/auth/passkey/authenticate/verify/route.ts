import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import * as z from "zod";
import { operationsDestination } from "@/lib/admin";
import {
  consumePasskeyChallenge,
  passkeyCookieOptions,
  PASSKEY_COOKIE,
  type StoredPasskey,
  webAuthnConfig,
} from "@/lib/passkeys";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  response: z.custom<AuthenticationResponseJSON>(),
  next: z.string().max(200).optional(),
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
    const challenge = await consumePasskeyChallenge(
      decodeURIComponent(browserToken),
      "authentication"
    );
    if (!challenge) {
      return NextResponse.json({ error: "Passkey request expired." }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: passkey, error: passkeyError }, { data: profile }] =
      await Promise.all([
        admin
          .from("staff_passkeys")
          .select(
            "id, profile_id, email, credential_id, public_key, counter, device_type, backed_up, transports, label"
          )
          .eq("profile_id", challenge.profile_id)
          .eq("credential_id", parsed.data.response.id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", challenge.profile_id)
          .maybeSingle(),
      ]);

    if (
      passkeyError ||
      !passkey ||
      !profile?.is_active ||
      (profile.role !== "admin" && profile.role !== "staff")
    ) {
      return NextResponse.json({ error: "Passkey sign-in failed." }, { status: 401 });
    }

    const stored = passkey as StoredPasskey;
    const { origin, rpID } = webAuthnConfig(request);
    const verification = await verifyAuthenticationResponse({
      response: parsed.data.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64")),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });

    if (!verification.verified || !verification.authenticationInfo.userVerified) {
      return NextResponse.json({ error: "Passkey sign-in failed." }, { status: 401 });
    }

    const { error: updateError } = await admin
      .from("staff_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", stored.id);
    if (updateError) throw updateError;

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: stored.email,
      });
    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError ?? new Error("Supabase did not return a session token.");
    }

    const supabase = await createClient();
    const { error: sessionError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });
    if (sessionError) throw sessionError;

    const response = NextResponse.json({
      ok: true,
      destination: operationsDestination(parsed.data.next),
    });
    response.cookies.set(PASSKEY_COOKIE, "", {
      ...passkeyCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[passkey] authentication verification failed:", error);
    return NextResponse.json({ error: "Passkey sign-in failed." }, { status: 401 });
  }
}