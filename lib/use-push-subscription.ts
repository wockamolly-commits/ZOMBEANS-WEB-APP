"use client";

import { useCallback, useEffect, useState } from "react";

export type PushOptInStatus =
  | "unsupported"
  | "ios-install-required"
  | "default"
  | "subscribing"
  | "subscribed"
  | "denied"
  | "error";

type SubscribeArgs =
  | { role: "customer"; orderCode: string }
  | { role: "rider" };

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes.buffer;
}

function isIosDevice(): boolean {
  // iPadOS 13+ reports as "Macintosh"; treat a touch-capable Mac as iPad.
  const ua = window.navigator.userAgent;
  const iOsUa = /iphone|ipad|ipod/i.test(ua);
  const iPadOs =
    /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOsUa || iPadOs;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosStandaloneNeeded(): boolean {
  return isIosDevice() && !isStandaloneDisplay();
}

export function usePushSubscription(args: SubscribeArgs) {
  const [status, setStatus] = useState<PushOptInStatus>("default");
  // Read once on the client (UA is unavailable during SSR); starting false
  // avoids a hydration mismatch. Drives iOS-only UI copy (e.g. the ringer/
  // silent-switch hint, since iOS notification sound follows that switch).
  const [isIos, setIsIos] = useState(false);

  // Depend on the primitive fields, not the freshly-allocated `args` object, so
  // effects/callbacks are stable across renders and re-run only when the order
  // being tracked actually changes.
  const role = args.role;
  const orderCode = args.role === "customer" ? args.orderCode : undefined;

  // Registers the service worker, ensures a push subscription exists, and
  // persists it against the CURRENT order/rider. Assumes permission is already
  // granted (never prompts) so it is safe to run silently on mount.
  const persistSubscription = useCallback(async (): Promise<boolean> => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const body =
      role === "customer"
        ? { role: "customer", orderCode, subscription }
        : { role: "rider", subscription };

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  }, [role, orderCode]);

  // One-time read of browser/permission APIs unavailable during SSR, plus a
  // silent re-subscribe when permission is already granted. Customer push rows
  // are keyed by order_code, so without this a returning customer who opted in
  // on a previous order would have no live subscription for the new one, and
  // would never get a background push. Runs again whenever the order changes.
  // One-time client read of the UA (unavailable during SSR), kept in its own
  // effect so it doesn't shift the set-state-in-effect exemption below.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(isIosDevice());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    if (isIosStandaloneNeeded()) {
      setStatus("ios-install-required");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission !== "granted") {
      setStatus("default");
      return;
    }

    let cancelled = false;
    setStatus("subscribing");
    void persistSubscription()
      .then((ok) => {
        if (!cancelled) setStatus(ok ? "subscribed" : "error");
      })
      .catch((error) => {
        console.error("[push] silent re-subscribe failed:", error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [persistSubscription]);

  // Explicit opt-in from a user gesture: prompts for permission (required by
  // iOS and most browsers), then persists the subscription.
  const subscribe = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setStatus("error");
      return;
    }

    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return;
      }
      setStatus((await persistSubscription()) ? "subscribed" : "error");
    } catch (error) {
      console.error("[push] subscribe failed:", error);
      setStatus("error");
    }
  }, [persistSubscription]);

  return { status, subscribe, isIos };
}
