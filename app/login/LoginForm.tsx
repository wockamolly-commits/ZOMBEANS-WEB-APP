"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import {
  requestOtp,
  verifyOtp,
  type LoginState,
  type VerifyOtpState,
} from "./actions";

const initialLogin: LoginState = { status: "idle" };
const initialVerify: VerifyOtpState = { status: "idle" };
const EMPTY_DIGITS = Array(6).fill("") as string[];

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function loginErrorMessage(error: string | null) {
  if (error === "not_authorized") {
    return "That email is not authorized for this team area.";
  }
  if (error === "invalid_link") {
    return "That sign-in link is invalid or expired. Request a 6-digit code instead.";
  }
  if (error === "link_disabled") {
    return "Email links are no longer supported. Enter your email to receive a 6-digit code.";
  }
  return null;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const isStaffInvite = searchParams.get("invite") === "staff";
  const inviteEmail = isStaffInvite ? (searchParams.get("email") ?? "") : "";
  const invitationId = isStaffInvite
    ? (searchParams.get("invitationId") ?? "")
    : "";
  const initialError = loginErrorMessage(searchParams.get("error"));
  const [loginState, loginAction, loginPending] = useActionState(
    requestOtp,
    initialLogin
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOtp,
    initialVerify
  );
  const [otpDraft, setOtpDraft] = useState<{
    sentKey: number;
    digits: string[];
  }>({ sentKey: 0, digits: EMPTY_DIGITS });
  const [now, setNow] = useState(() => Date.now());
  const loginFormRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedInviteRef = useRef(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
  }, []);

  useEffect(() => {
    if (
      !autoSubmittedInviteRef.current &&
      inviteEmail &&
      invitationId &&
      loginState.status === "idle"
    ) {
      autoSubmittedInviteRef.current = true;
      loginFormRef.current?.requestSubmit();
    }
  }, [invitationId, inviteEmail, loginState.status]);

  useEffect(() => {
    if (loginState.status === "sent") {
      inputRefs.current[0]?.focus();
    }
  }, [loginState.expiresAt, loginState.status]);

  const remainingSeconds = Math.max(
    0,
    Math.ceil(((loginState.expiresAt ?? now) - now) / 1000)
  );
  const resendSeconds = Math.max(
    0,
    Math.ceil(((loginState.resendAvailableAt ?? now) - now) / 1000)
  );
  const sentKey = loginState.expiresAt ?? 0;
  const digits = otpDraft.sentKey === sentKey ? otpDraft.digits : EMPTY_DIGITS;
  const codeExpired = loginState.status === "sent" && remainingSeconds === 0;
  const canResend = loginState.status === "sent" && resendSeconds === 0;
  const codeValue = useMemo(() => digits.join(""), [digits]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    setOtpDraft((current) => {
      const currentDigits =
        current.sentKey === sentKey ? current.digits : EMPTY_DIGITS;
      const nextDigits = [...currentDigits];
      if (clean.length <= 1) {
        nextDigits[index] = clean;
      } else {
        clean
          .slice(0, 6 - index)
          .split("")
          .forEach((digit, offset) => {
            nextDigits[index + offset] = digit;
          });
      }
      return { sentKey, digits: nextDigits };
    });

    const focusOffset = clean.length > 1 ? clean.length : clean ? 1 : 0;
    const nextInput = inputRefs.current[Math.min(index + focusOffset, 5)];
    if (nextInput && clean) nextInput.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    setDigit(index, pasted);
  }

  if (loginState.status === "sent" && loginState.email) {
    return (
      <div className="mt-8 space-y-5">
        <div className="rounded-xl border border-zb-bone/35 bg-zb-bone/10 p-4 text-sm text-zb-cream">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-zb-bone" />
            <div>
              <p className="font-semibold">Enter the 6-digit code</p>
              <p className="mt-1 text-zb-cream/65">
                We sent it to{" "}
                <span className="font-semibold text-zb-cream">
                  {loginState.email}
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={loginState.email} />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="token" value={codeValue} />
          <div className="grid grid-cols-6 gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                name={`digit-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                aria-label={`Code digit ${index + 1}`}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={(event) => handlePaste(index, event)}
                className="h-12 min-w-0 rounded-lg border border-zb-sage/35 bg-zb-primary-dark/65 text-center font-mono text-xl font-semibold text-zb-cream outline-none transition focus:border-zb-bone focus:ring-2 focus:ring-zb-bone/20 sm:h-14 sm:text-2xl"
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zb-cream/60">
            <span className="font-mono-tabular">
              {codeExpired
                ? "Code expired"
                : `Expires in ${formatRemaining(remainingSeconds)}`}
            </span>
            <span>Use the latest code we emailed.</span>
          </div>

          {verifyState.status === "error" && (
            <p
              role="alert"
              className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream"
            >
              {verifyState.message}
            </p>
          )}
          {loginState.message && (
            <p
              role={loginState.messageTone === "error" ? "alert" : "status"}
              className={`rounded-lg border px-3 py-2 text-xs text-zb-cream ${
                loginState.messageTone === "error"
                  ? "border-zb-danger/40 bg-zb-danger/10"
                  : "border-zb-bone/30 bg-zb-bone/10"
              }`}
            >
              {loginState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={verifyPending || codeExpired || codeValue.length !== 6}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
          >
            <KeyRound className="size-4" aria-hidden />
            {verifyPending ? "Verifying..." : "Verify code"}
          </button>
        </form>

        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={loginAction} className="flex-1">
            <input type="hidden" name="email" value={loginState.email} />
            <input type="hidden" name="invitationId" value={invitationId} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              disabled={loginPending || !canResend}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zb-sage/35 px-4 text-sm font-semibold text-zb-cream transition hover:border-zb-bone disabled:cursor-not-allowed disabled:opacity-55"
            >
              <RefreshCw className="size-4" aria-hidden />
              {loginPending
                ? "Sending..."
                : canResend
                  ? "Resend code"
                  : `Resend in ${resendSeconds}s`}
            </button>
          </form>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-zb-cream/70 transition hover:text-zb-cream"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={loginFormRef} action={loginAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <label className="block text-sm font-medium text-zb-cream">
        Email
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-zb-bone" />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={loginState.email ?? inviteEmail}
            placeholder="you@email.com"
            readOnly={Boolean(inviteEmail)}
            className="mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 pl-11 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20"
          />
        </span>
      </label>
      {isStaffInvite && !initialError && loginState.status === "idle" && (
        <p className="rounded-lg border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs text-zb-cream">
          Opening your staff invitation. We&apos;ll email the 6-digit code on
          this page.
        </p>
      )}
      {(loginState.status === "error" || initialError) && (
        <p
          role="alert"
          className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream"
        >
          {loginState.message ?? initialError}
        </p>
      )}
      <button
        type="submit"
        disabled={loginPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
      >
        <KeyRound className="size-4" aria-hidden />
        {loginPending ? "Sending code..." : "Email me a 6-digit code"}
      </button>
      <p className="text-center text-xs leading-5 text-zb-cream/55">
        No password needed. We&apos;ll verify your email with a one-time code.
      </p>
    </form>
  );
}
