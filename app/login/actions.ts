"use server";

import { createHash } from "node:crypto";
import type { EmailOtpType } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import {
  authenticatedDestination,
  requestedDestination,
  type AuthFlow,
} from "@/lib/auth-destination";
import {
  hasPendingStaffInvitation,
  resolveAdminEmailAccess,
  type AdminEmailAccess,
} from "@/lib/admin-auth";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

const OTP_EXPIRES_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 60;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_REQUESTS = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 8;

type MessageTone = "error" | "success";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  messageTone?: MessageTone;
  email?: string;
  expiresAt?: number;
  resendAvailableAt?: number;
};

export type VerifyOtpState = {
  status: "idle" | "error";
  message?: string;
};

type RateBucket = {
  count: number;
  resetAt: number;
  lastAt?: number;
};

const requestBuckets = new Map<string, RateBucket>();
const verifyBuckets = new Map<string, RateBucket>();

const requestSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).trim().toLowerCase(),
  invitationId: z.uuid().optional(),
  next: z.string().max(200).optional(),
});

const verifySchema = requestSchema.extend({
  token: z.string().regex(/^\d{6}$/),
});

function flowForAccess(access: AdminEmailAccess): AuthFlow {
  return access ? "admin" : "customer";
}

function shouldCreateUser(access: AdminEmailAccess): boolean {
  return access === "super_admin" || access === "invited" || !access;
}

function hashKey(parts: Array<string | null | undefined>): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join("|"))
    .digest("hex");
}

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    headerStore.get("x-real-ip") ||
    headerStore.get("cf-connecting-ip") ||
    "unknown"
  );
}

function pruneBuckets(map: Map<string, RateBucket>, now: number) {
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}

function consumeRequestSlot(key: string, now: number) {
  pruneBuckets(requestBuckets, now);
  const bucket =
    requestBuckets.get(key) ?? { count: 0, resetAt: now + OTP_REQUEST_WINDOW_MS };

  if (bucket.lastAt && now - bucket.lastAt < OTP_RESEND_SECONDS * 1000) {
    return {
      allowed: false,
      retryAfterMs: OTP_RESEND_SECONDS * 1000 - (now - bucket.lastAt),
    };
  }

  if (bucket.count >= OTP_MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  bucket.lastAt = now;
  requestBuckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

function consumeVerifySlot(key: string, now: number) {
  pruneBuckets(verifyBuckets, now);
  const bucket =
    verifyBuckets.get(key) ?? { count: 0, resetAt: now + OTP_VERIFY_WINDOW_MS };

  if (bucket.count >= OTP_MAX_VERIFY_ATTEMPTS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  verifyBuckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

function retryMessage(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (seconds < 60) return `Please wait ${seconds}s before trying again.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Please wait about ${minutes} min before trying again.`;
}

function readOtpToken(formData: FormData): string {
  const token = formData.get("token");
  if (typeof token === "string" && token.trim()) {
    return token.replace(/\D/g, "");
  }
  return Array.from({ length: 6 }, (_, index) => {
    const value = formData.get(`digit-${index}`);
    return typeof value === "string" ? value.replace(/\D/g, "") : "";
  }).join("");
}

function otpVerificationTypes(access: AdminEmailAccess): EmailOtpType[] {
  if (access === "invited") return ["email", "invite", "signup"];
  if (access) return ["email", "magiclink"];
  return ["email", "signup", "magiclink"];
}

export async function requestOtp(
  previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = requestSchema.safeParse({
    email: formData.get("email"),
    invitationId: formData.get("invitationId") || undefined,
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return {
      ...previous,
      status: previous.status === "sent" ? "sent" : "error",
      message: "Enter a valid email address.",
      messageTone: "error",
    };
  }

  const { email, invitationId } = parsed.data;
  const ip = await clientIp();
  const rateKey = hashKey(["otp-request", email, invitationId, ip]);
  const now = Date.now();
  const rate = consumeRequestSlot(rateKey, now);
  if (!rate.allowed) {
    return {
      ...previous,
      status: previous.status === "sent" ? "sent" : "error",
      email,
      message: retryMessage(rate.retryAfterMs),
      messageTone: "error",
    };
  }

  let access: AdminEmailAccess;
  try {
    access = await resolveAdminEmailAccess(email);
  } catch (error) {
    console.error("[login] admin email check failed:", error);
    return {
      ...previous,
      status: previous.status === "sent" ? "sent" : "error",
      message: "Could not send a code. Try again.",
      messageTone: "error",
      email,
    };
  }

  if (access === "invited") {
    if (!invitationId) {
      return {
        ...previous,
        status: previous.status === "sent" ? "sent" : "error",
        message: "Open the staff invitation link first to request a code.",
        messageTone: "error",
        email,
      };
    }

    let validInvitation = false;
    try {
      validInvitation = await hasPendingStaffInvitation(email, invitationId);
    } catch (error) {
      console.error("[login] staff invitation check failed:", error);
      return {
        ...previous,
        status: previous.status === "sent" ? "sent" : "error",
        message: "Could not check the staff invitation. Try again.",
        messageTone: "error",
        email,
      };
    }

    if (!validInvitation) {
      return {
        ...previous,
        status: previous.status === "sent" ? "sent" : "error",
        message: "That staff invitation is invalid or expired.",
        messageTone: "error",
        email,
      };
    }
  }

  const supabase =
    flowForAccess(access) === "admin"
      ? await createAdminSessionClient()
      : await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: shouldCreateUser(access),
    },
  });

  if (error) {
    console.error("[login] signInWithOtp failed:", error.status, error.message);
    return {
      ...previous,
      status: previous.status === "sent" ? "sent" : "error",
      message:
        error.status === 429
          ? "Too many code requests. Please wait a bit and try again."
          : "Could not send a code. Try again.",
      messageTone: "error",
      email,
    };
  }

  return {
    status: "sent",
    email,
    expiresAt: now + OTP_EXPIRES_SECONDS * 1000,
    resendAvailableAt: now + OTP_RESEND_SECONDS * 1000,
    message:
      previous.status === "sent"
        ? "A fresh 6-digit code was sent."
        : "We sent a 6-digit code to your email.",
    messageTone: "success",
  };
}

export async function verifyOtp(
  _previous: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
    token: readOtpToken(formData),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the 6-digit code from your email.",
    };
  }

  const { email, next, token } = parsed.data;
  const ip = await clientIp();
  const verifyKey = hashKey(["otp-verify", email, ip]);
  const rate = consumeVerifySlot(verifyKey, Date.now());
  if (!rate.allowed) {
    return { status: "error", message: retryMessage(rate.retryAfterMs) };
  }

  let access: AdminEmailAccess;
  try {
    access = await resolveAdminEmailAccess(email);
  } catch (error) {
    console.error("[login] admin email check failed:", error);
    return { status: "error", message: "Could not verify the code. Try again." };
  }

  const flow = flowForAccess(access);
  const requested = requestedDestination(flow, next);
  const supabase =
    flow === "admin" ? await createAdminSessionClient() : await createClient();
  const verificationTypes = otpVerificationTypes(access);
  let lastError:
    | Awaited<ReturnType<typeof supabase.auth.verifyOtp>>["error"]
    | null = null;

  for (const type of verificationTypes) {
    const result = await supabase.auth.verifyOtp({ email, token, type });
    if (!result.error) {
      verifyBuckets.delete(verifyKey);
      const destination = await authenticatedDestination(
        supabase,
        requested,
        flow
      );
      redirect(destination);
    }
    lastError = result.error;
  }

  console.error(
    "[login] verifyOtp failed:",
    lastError?.status,
    lastError?.message
  );
  return {
    status: "error",
    message:
      lastError?.status === 429
        ? "Too many verification attempts. Please wait a bit and try again."
        : "That code is invalid or expired. Check it or request a new one.",
  };
}
