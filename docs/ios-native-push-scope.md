# Scope: Guaranteed iOS Haptics/Alerts via a Native Wrapper

Written 2026-07-01, as a follow-up to `docs/web-push-notifications.md`. This
scopes what it would take to get **reliable, controllable alerts on iPhone**
(custom sound, vibration/haptics, alerting even on silent/DND) — which Web Push
on iOS fundamentally cannot do.

## Why the web can't do it on iOS

Even with the PWA manifest + Web Push work now shipped, iPhone is capped by the
platform:

- **No `navigator.vibrate` and no notification `vibrate`.** WebKit exposes
  neither. There is no web API to trigger a haptic from a notification on iOS.
- **No custom notification sound.** iOS uses the default notification sound;
  the web app can't ship its own.
- **Sound/haptic follow the hardware ringer + iOS notification settings.** On
  silent, there's no sound; the web app can't override it.
- **Must be an installed standalone PWA** just to get the banner at all
  (iOS 16.4+).

A native (or hybrid-native) app is the only way past these, because only native
code can call `UNNotificationSound` (custom sound), `UIFeedbackGenerator` /
critical alerts, and register for APNs with an entitlement.

## Options

| Option | What it is | Effort | Verdict |
|---|---|---|---|
| **A. Capacitor wrapper (recommended)** | Wrap the *existing* Next.js site in a Capacitor shell; add native push + haptics plugins. Reuse ~100% of current UI/logic. | Medium | Best effort-to-value; keeps one codebase. |
| B. React Native / Expo rewrite | Rebuild the customer/rider UIs natively. | High | Only worth it if a broader native app is planned anyway. |
| C. Stay PWA-only | Accept iOS limits; keep hardening Android + web. | None | Fine if iPhone haptics aren't business-critical. |

## Option A — Capacitor, in detail

### Architecture
- Capacitor loads the deployed web app (either the remote `https://zombeans.xyz`
  in a `WKWebView`, or a bundled build). The **realtime + in-tab alert system
  keeps working unchanged** inside the webview.
- Native push replaces Web Push **on iOS only**: `@capacitor/push-notifications`
  registers with **APNs** and hands the device token to our backend. Web/Android
  keep using the existing VAPID Web Push path.
- `@capacitor/haptics` (or a small custom plugin) fires haptics on important
  events; the webview calls it via the Capacitor bridge.

### Server changes
- `push_subscriptions` gains an APNs token type alongside the current web
  endpoints (add a `platform`/`token_type` column, or a sibling table).
- `lib/push-notifications.ts` gains an APNs sender (e.g. `@parse/node-apn` or
  `node-apn`) with the Apple **`.p8` auth key**, used for `role`/`order_code`
  lookups exactly like `sendPushToOrder` / `sendPushToUser` today. The send
  helper picks web-push vs APNs per subscription row — call sites don't change.
- For **critical alerts** (sound + haptic even on silent/DND — relevant to the
  rider "new delivery" and "rider outside" cases), the payload sets the
  critical-alert flag; see entitlement note below.

### Apple prerequisites (the real gating items)
- **Apple Developer Program** membership — **$99/year**.
- App IDs + **APNs auth key (`.p8`)** and push entitlement.
- App Store review + listing (or TestFlight for internal/staff-only rider app).
- **Critical Alerts** (bypass silent/DND) require a **special entitlement you
  request from Apple by justification** — approval is not guaranteed and is
  meant for safety/urgent use. Order-ready likely won't qualify; a rider
  "new delivery" alarm has a better (still uncertain) case. Without it, custom
  sound + haptic still work, but **not** through silent/DND.

### Rough effort
- Capacitor shell + build/CI wiring: ~1–2 days.
- iOS APNs registration + token storage + server APNs sender: ~2–4 days.
- Haptics bridge + wiring to alert events: ~1 day.
- App Store setup, signing, review iteration: ~2–5 days elapsed (mostly waiting).
- **Total: ~1.5–2 weeks of work + Apple review latency + $99/yr.**

### Consequences
- Two delivery targets (web + iOS app) and an Apple release process to maintain.
- Android can stay pure PWA, or also ship via Capacitor for parity (haptics
  there already work over the web, so lower urgency).
- Users must install from the App Store instead of "Add to Home Screen."

## Recommendation

1. **Ship + measure the current web/PWA hardening first.** Android now has full
   background popups + vibration; iPhone has banners + default sound once
   installed. Confirm on real devices whether the residual iPhone gap
   (silent-mode haptics) actually costs missed orders.
2. **If iPhone silent-mode alerting is business-critical** (most likely for
   **riders**, who must not miss an assignment), pursue **Option A (Capacitor)** —
   and consider a **rider-only** iOS app first (smaller surface, TestFlight
   avoids public App Store review, best critical-alert justification).
3. Keep customers on the PWA unless data shows the iPhone gap is hurting them.

### Suggested next step
A rider-only Capacitor spike: prove APNs token → server → `node-apn` send →
device banner with custom sound, before committing to the full build and the
Critical Alerts entitlement request.
