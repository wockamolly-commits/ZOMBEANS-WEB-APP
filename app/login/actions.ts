"use server";

import { headers } from "next/headers";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

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
  _prev: LoginState,
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
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
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
