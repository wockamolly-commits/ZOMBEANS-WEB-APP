# Real-Device Push Test Checklist

Hand-off checklist for verifying the cross-device notification hardening
(2026-07-01). These paths **cannot** be verified in a desktop browser or
simulator — use real phones. Run against the deployed URL, not localhost
(push + PWA install need HTTPS).

## Setup (once)
- [ ] Deploy is live and you've hard-reloaded the site at least once on each
      test phone (the updated service worker + per-order re-subscribe only take
      effect after a post-deploy visit).
- [ ] Have a way to trigger status changes: a staff/workspace login to mark
      orders ready / assign a rider / mark out-for-delivery.
- [ ] Use a real low-value test order for each run.

---

## Android (Chrome) — expect the big win
- [ ] Open a tracking page, tap **"Get alerts even when your phone is locked"**,
      accept the permission prompt.
- [ ] **Lock the phone.** From workspace, mark the order **ready**.
      → Expect: OS popup notification **+ vibration** on the lock screen.
- [ ] **Swipe the app fully closed.** Trigger another status change
      (e.g. out-for-delivery).
      → Expect: popup **+ vibration** still fire with the app not running.
- [ ] Tap the notification → opens the correct `/order/[code]` page.
- [ ] **Delivery "rider outside":** have the rider tap "I'm outside" twice.
      → Expect: it **re-alerts/buzzes each time** (not silently replaced).
- [ ] Turn on **DND/silent**, trigger a status change.
      → Expect: still **vibrates** (sound may be suppressed by DND — that's OK).

## iPhone (Safari) — requires Home Screen install
- [ ] In Safari, open the tracking page. Expect the banner:
      *"Add Zombeans to your Home Screen…"* + the *"silent switch off"* line.
- [ ] **Share → Add to Home Screen.** Open Zombeans from the **new icon**
      (not Safari).
- [ ] Tap the enable-alerts affordance, accept permission.
      → Expect the pill: *"Order alerts are on. Keep your ringer on…"*
- [ ] **Lock the phone**, mark the order ready.
      → Expect: system banner **+ default notification sound** (ringer ON).
- [ ] Flip the **silent switch on**, trigger another change.
      → Expect: banner shows, **no sound** (this is an iOS limit, not a bug).
- [ ] Tap the banner → opens the correct order page.
- [ ] Note: **no custom vibration/sound on iPhone** — don't file that as a bug;
      see `docs/ios-native-push-scope.md`.

## Returning-customer regression (both platforms) — the key fix
- [ ] With permission already granted, place a **brand-new** order and open its
      tracking page. Do **not** re-tap any enable button.
- [ ] Lock/close the app, mark the new order ready.
      → Expect: background push arrives **for the new order** (previously this
      silently failed because the subscription was tied to the old order code).

## Rider (logged-in) — highest-stakes path
- [ ] Log in as a rider, open the rider dashboard, enable alerts.
- [ ] Lock/close the app. From workspace, **assign a delivery** to that rider.
      → Expect: push **+ vibration** (Android) / banner (iPhone installed PWA),
      notification opens `/rider/delivery/[id]`.
- [ ] Confirm the in-dashboard loud alarm + toast still fire when the app is
      open (regression check — unchanged behavior).

## In-tab regression (both) — make sure nothing broke
- [ ] With the app **open/foreground**, trigger each status change.
      → Expect: existing sound + toast fire exactly as before (the push layer
      is additive and must not affect this).

---

### If something fails
- **No popup at all, app closed (Android):** check DevTools → Application →
  Service Workers is active, and Push shows a subscription. Check the server
  logs for `[push]` errors (VAPID env vars, 404/410 cleanups).
- **iPhone nothing even after install:** confirm it was opened from the Home
  Screen icon (standalone), iOS ≥ 16.4, and permission granted inside the
  installed PWA (permission from Safari does not carry over).
- **New order gets no push but old one did:** confirm the tracking page was
  actually opened for the new order (that's what triggers the silent
  re-subscribe) and that a hard reload happened post-deploy.
