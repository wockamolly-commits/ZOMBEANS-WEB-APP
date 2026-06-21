"use server";

import { headers } from "next/headers";
import * as z from "zod";
import { resolveAdminEmailAccess } from "@/lib/admin-auth";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const schema = z.object({
  email: z.email({ error: "Enter a valid email address." }).trim(),
  next: z.string().max(200).optional(),
});

export async function requestMagicLink(
  previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  return sendMagicLink(previous, formData, false);
}

export async function requestAdminMagicLink(
  previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  return sendMagicLink(previous, formData, true);
}

async function sendMagicLink(
  _previous: LoginState,
  formData: FormData,
  adminOnly: boolean
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const { email, next } = parsed.data;
  let access;
  try {
    access = await resolveAdminEmailAccess(email);
  } catch (error) {
    console.error("[login] admin email check failed:", error);
    return { status: "error", message: "Could not sign in. Try again.", email };
  }

  // Keep this generic so the admin entry point cannot enumerate staff emails.
  if (adminOnly && !access) return { status: "sent", email };

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const flow = access ? "admin" : "customer";
  const destination = access ? "/workspace" : safeNextPath(next);
  const redirectTo = `${origin}/auth/confirm?flow=${flow}&next=${encodeURIComponent(
    destination
  )}`;

  const supabase = access
    ? await createAdminSessionClient()
    : await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: access === "super_admin" || !access,
    },
  });

  if (error) {
    console.error("[login] signInWithOtp failed:", error.status, error.message);
    return {
      status: "error",
      message:
        error.status === 429
          ? "Too many sign-in attempts. Please wait a bit and try again."
          : "Could not send the link. Try again.",
      email,
    };
  }
  return { status: "sent", email };
}
