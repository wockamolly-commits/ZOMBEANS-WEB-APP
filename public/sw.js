// Web Push service worker. Supplements the in-tab realtime alert system
// (audio + toast) with OS-level notifications when the tab is backgrounded,
// the phone is locked, or the site isn't open. See
// docs/web-push-notifications.md for the design.

// A vibration pattern set on the notification itself is the ONLY way to buzz
// the device when no page is open (navigator.vibrate needs a live page). It is
// honoured on Android; iOS ignores it, but including it is harmless there.
const DEFAULT_VIBRATE = [220, 90, 220, 90, 360];

// Take control immediately so an updated worker starts handling pushes without
// waiting for every tab to close.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Zombeans", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Zombeans";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    icon: "/icon.png",
    badge: "/badge.png",
    // Buzz on delivery (Android). Payload may override with its own pattern.
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : DEFAULT_VIBRATE,
    // Re-alert (sound + vibration) even when a same-tag notification is already
    // showing — critical for the repeating "rider outside" ping.
    renotify: Boolean(data.tag) && data.renotify !== false,
    // Keep high-priority alerts (rider outside) on screen until acted on.
    requireInteraction: data.requireInteraction === true,
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      for (const client of clientsList) {
        if ("focus" in client && "navigate" in client) {
          await client.focus();
          return client.navigate(targetUrl);
        }
      }

      return self.clients.openWindow(targetUrl);
    })()
  );
});
