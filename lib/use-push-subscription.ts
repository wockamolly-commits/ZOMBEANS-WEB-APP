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

function isIosStandaloneNeeded(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (!isIos) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

export function usePushSubscription(args: SubscribeArgs) {
  const [status, setStatus] = useState<PushOptInStatus>("default");

  // One-time read of browser/permission APIs unavailable during SSR -
  // starting from the "default" SSR value avoids a hydration mismatch, so
  // the follow-up setState here is intentional.
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
    if (Notification.permission === "granted") {
      setStatus("subscribed");
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    } else {
      setStatus("default");
    }
  }, []);

  const subscribe = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
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
        args.role === "customer"
          ? { role: "customer", orderCode: args.orderCode, subscription }
          : { role: "rider", subscription };

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("subscribed");
    } catch (error) {
      console.error("[push] subscribe failed:", error);
      setStatus("error");
    }
  }, [args]);

  return { status, subscribe };
}
