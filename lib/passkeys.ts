import "server-only";
import { randomBytes } from "node:crypto";
import type {
  AuthenticatorTransportFuture,
  Base64URLString,
} from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const PASSKEY_COOKIE = "zb_passkey_challenge";
export const PASSKEY_CHALLENGE_TTL_SECONDS = 5 * 60;

export type OperationsIdentity = {
  id: string;
  role: "admin" | "staff";
  display_name: string;
  email: string;
};

export type StoredPasskey = {
  id: string;
  profile_id: string;
  email: string;
  credential_id: Base64URLString;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: boolean;
  transports: AuthenticatorTransportFuture[];
  label: string;
};

export type StoredChallenge = {
  id: string;
  browser_token: string;
  profile_id: string;
  purpose: "registration" | "authentication";
  challenge: string;
  expires_at: string;
  used_at: string | null;
};

export async function resolveActiveOperationsEmail(
  email: string
): Promise<OperationsIdentity | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_active_operations_email", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as OperationsIdentity | undefined) ?? null;
}

export async function getPasskeysForProfile(
  profileId: string
): Promise<StoredPasskey[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_passkeys")
    .select(
      "id, profile_id, email, credential_id, public_key, counter, device_type, backed_up, transports, label"
    )
    .eq("profile_id", profileId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as StoredPasskey[];
}

export function webAuthnConfig(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin = configuredOrigin || requestOrigin;
  const url = new URL(origin);
  const rpID = process.env.PASSKEY_RP_ID || url.hostname;

  if (configuredOrigin && requestOrigin !== configuredOrigin) {
    throw new Error("Passkeys are not available from this site origin.");
  }

  return { origin, rpID, rpName: "Zombeans" };
}

export async function createPasskeyChallenge(input: {
  profileId: string;
  purpose: StoredChallenge["purpose"];
  challenge: string;
}) {
  const admin = createAdminClient();
  const browserToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + PASSKEY_CHALLENGE_TTL_SECONDS * 1000
  ).toISOString();

  const { error: cleanupError } = await admin
    .from("staff_passkey_challenges")
    .delete()
    .eq("profile_id", input.profileId)
    .eq("purpose", input.purpose);
  if (cleanupError) throw cleanupError;

  const { error } = await admin.from("staff_passkey_challenges").insert({
    browser_token: browserToken,
    profile_id: input.profileId,
    purpose: input.purpose,
    challenge: input.challenge,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return browserToken;
}

export async function consumePasskeyChallenge(
  browserToken: string,
  purpose: StoredChallenge["purpose"]
): Promise<StoredChallenge | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_staff_passkey_challenge", {
    p_browser_token: browserToken,
    p_purpose: purpose,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as StoredChallenge | undefined) ?? null;
}

export function passkeyCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/passkey",
    maxAge: PASSKEY_CHALLENGE_TTL_SECONDS,
  };
}