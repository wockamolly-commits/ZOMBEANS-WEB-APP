# Web Push Notifications (Locked-Screen / Backgrounded Alerts)

Design doc from a brainstorming session on 2026-07-01. Extends the real-time
in-tab alert system (audio + toast) built for customers and riders so that
alerts still reach them when the phone is locked, the tab is backgrounded, or
the site isn't open.

## Understanding Summary

- **Goal:** Customers tracking an order and riders on the delivery dashboard
  should get notified even when the phone is locked or the browser isn't in
  the foreground.
- **Why:** The existing system (`components/shop/CustomerOrderNotificationsProvider.tsx`,
  rider dashboard) uses in-page `AudioContext` + toast, which is confirmed
  dead once the tab loses focus or the screen locks (see
  `docs/../memory` notes on AudioContext lifecycle from the same day).
- **Mechanism:** Web Push (Service Worker + Push API) — the only mechanism
  that can show a system notification with no app/tab open. There is no
  native app, so this is the only path (SMS was considered and rejected).
- **Platform constraint:** iOS Safari only supports push if the site is
  installed via "Add to Home Screen." We prompt for that rather than
  silently degrading.
- **Backend:** Self-hosted `web-push` npm package + VAPID keys. Subscriptions
  stored in a new Supabase table. Sends are bolted directly onto the existing
  broadcast functions — no new "is this event alert-worthy" logic.
- **Coverage:** All existing alert types get a push equivalent — ready,
  out_for_delivery, rider_outside, completed, rejected (customer) and
  new-delivery-assigned (rider).

## Assumptions

1. Push **supplements** the in-tab system; it does not replace it. When the
   tab is open/foregrounded, the instant in-tab audio+toast still fires.
2. Customer push subscriptions are keyed by **order short_code** (guest
   checkout has no `user_id`), not solely by logged-in user.
3. Rider subscriptions are keyed by `user_id` (riders are always logged-in
   staff accounts).
4. Permission request UX mirrors the existing "tap to enable sound alerts"
   pill — explicit opt-in tap, no auto-prompt on page load.
5. Requires a new Supabase table + migration with explicit GRANTs (this
   project does not use default privileges — see memory
   `gotcha-explicit-table-grants`).

## Approaches Considered

| Approach | Description | Verdict |
|---|---|---|
| **A. Direct inline send (chosen)** | Push send is one more call inside the existing broadcast functions, fire-and-forget. | Smallest change, reuses trusted alert logic, matches project's YAGNI history. |
| B. Outbox/queue worker | Write notification jobs to a table; separate cron/worker sends with retry. | Overkill — no worker/cron runtime exists today; push failures are low-stakes given in-tab + polling fallback already exist. |
| C. DB-trigger / Supabase Edge Function | Postgres trigger fires an Edge Function on status change. | Duplicates alert-worthiness logic that already lives in `lib/customer-order-realtime.ts`; adds a second deployment surface. |

## Design

### Components & Data Model

New table `push_subscriptions`:

```
id              uuid PK
role            text check in ('customer','rider')
order_code      text nullable   -- customer subs, guest-trackable by short_code
user_id         uuid nullable   -- rider subs (and optionally logged-in customers)
endpoint        text            -- unique per browser subscription (upsert key)
p256dh          text
auth_key        text
created_at      timestamptz
last_seen_at    timestamptz
```

- `public/sw.js` — service worker handling `push` (show notification) and
  `notificationclick` (focus/open `/order/[code]` or `/rider/delivery/[id]`).
- Env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- `lib/push-notifications.ts` — thin `web-push` wrapper:
  `sendPushToSubscription(sub, payload)`, catches 404/410 and deletes the
  stale row, never throws into the caller.
- Client opt-in affordance (mirrors the sound-alert pill): registers the
  service worker, requests `Notification.permission`, subscribes via
  `PushManager.subscribe()`, POSTs to `app/api/push/subscribe/route.ts`.
- iOS not-installed detection via `window.matchMedia('(display-mode: standalone)')`
  + UA sniff → show "Add to Home Screen" banner instead of a broken enable button.

### Data Flow & Trigger Points

- Customer side: right after `lib/customer-order-broadcasts.ts` broadcasts a
  realtime event, look up subscriptions by `order_code` and fire pushes
  (not awaited by the caller).
- Rider side: right after the delivery-assignment action/RPC in
  `app/rider/actions.ts`, look up subscriptions by `user_id` and push.
- Payload: `{ title, body, url, tag }`. `tag` collapses duplicate OS
  notifications (e.g. repeated "rider outside" re-pings), reusing the same
  dedup concept as the in-tab system.
- No new alert-worthiness logic — every existing call site to the current
  broadcast helpers becomes the single push integration point.

### Edge Cases & Error Handling

- Expired/invalid subscription (404/410 from push service) → delete the row.
- Multiple devices per order/rider → push to all matching subscriptions.
- Permission denied → no auto re-prompt; pill stays tappable.
- iOS not installed to home screen → show install banner, don't attempt subscribe.
- Send failures are fire-and-forget and never block the request/mutation.
- Re-subscribe upserts on `endpoint`, no duplicate rows.

### Testing Strategy (manual — no automated suite for this system)

- DevTools service worker registration + subscribe flow.
- DevTools "Push" test button to verify `sw.js` handler in isolation.
- Real end-to-end: subscribe on phone, lock screen, trigger status change
  from staff workspace, confirm OS notification + tap-to-open.
- iOS: must test on a physical device added to home screen (Simulator does
  not support push).
- Failure path: revoke permission/unsubscribe, trigger event, confirm 410
  handling cleans up the row without erroring the broadcast call.
- Regression check: existing in-tab toast/sound flow still fires correctly
  with tab open and unaffected by the new fire-and-forget push calls.

## Decision Log

| Decision | Alternatives considered | Why chosen |
|---|---|---|
| Web Push (Service Worker + Push API) | Native app + FCM/APNs, SMS | No native app exists; SMS not requested, adds per-message cost/vendor. |
| Self-hosted `web-push` + VAPID | Firebase Cloud Messaging, OneSignal | No third-party account/cost/data-flow dependency needed. |
| Push supplements in-tab alerts | Replace in-tab system | In-tab is instant when open; push has provider latency/OS throttling. |
| Direct inline send (Approach A) | Outbox/queue (B), DB-trigger/Edge Function (C) | Smallest change, reuses trusted logic, no existing worker runtime to justify B/C. |
| Fire-and-forget sends | Awaited, blocking | Push provider issues must never delay the order-status mutation. |
| Subscriptions keyed by order_code (customer) / user_id (rider) | user_id-only | Guest checkout has no account. |
| iOS: prompt to "Add to Home Screen" | Silent degradation | User's explicit choice; only path to close the iOS gap. |
| `tag` field for OS-level dedup | No dedup / app-side only | Prevents notification stacking on repeat events (e.g. rider re-ring). |

## Open Items for Implementation

- Generate and store VAPID keys (local `.env` + Vercel env vars).
- Migration `00XX_push_subscriptions.sql` with explicit GRANTs.
- `public/sw.js`, subscribe API route, client opt-in component.
- Wire sends into `lib/customer-order-broadcasts.ts` and rider action handler(s).
- Manual test pass, including physical iOS device.
