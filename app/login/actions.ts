"use server";

import { headers } from "next/headers";
import * as z from "zod";
import {
  getPasskeysForProfile,
  resolveActiveOperationsEmail,
} from "@/lib/passkeys";
import { safeNextPath } from "@/lib/safe-next";
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
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const { email, next } = parsed.data;
  try {
    const staff = await resolveActiveOperationsEmail(email);
    if (staff) {
      return {
        status: "error",
        message: "Use your enrolled passkey to sign in.",
        email,
      };
    }
  } catch (error) {
    console.error("[login] staff email check failed:", error);
    return { status: "error", message: "Could not sign in. Try again.", email };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(
    safeNextPath(next)
  )}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    console.error("[login] signInWithOtp failed:", error.status, error.message);
    const message =
      error.status === 429
        ? "Too many sign-in attempts. Please wait a bit and try again."
        : "Could not send the link. Try again.";
    return { status: "error", message, email };
  }
  return { status: "sent", email };
}

export async function requestStaffEnrollmentLink(
  email: string
): Promise<LoginState> {
  const parsed = z.email().trim().safeParse(email);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  try {
    const staff = await resolveActiveOperationsEmail(parsed.data);
    if (!staff) {
      return { status: "error", message: "This staff account is not active." };
    }

    const passkeys = await getPasskeysForProfile(staff.id);
    if (passkeys.length > 0) {
      return {
        status: "error",
        message: "This staff account already has a passkey. Use it to sign in.",
        email: parsed.data,
      };
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
    const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(
      "/workspace/security"
    )}`;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });
    if (error) throw error;

    return { status: "sent", email: parsed.data };
  } catch (error) {
    console.error("[login] staff enrollment link failed:", error);
    const details = error instanceof Error ? error.message.toLowerCase() : "";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : undefined;
    const message = details.includes("not authorized") || status === 500
      ? "Supabase could not deliver to this Gmail alias. Configure custom SMTP or generate a local enrollment link from the project terminal."
      : details.includes("rate")
        ? "Too many email attempts. Wait a few minutes and try again."
        : "Could not send the enrollment link. Check the staff account email and Supabase email settings.";
    return {
      status: "error",
      message,
      email: parsed.data,
    };
  }
}