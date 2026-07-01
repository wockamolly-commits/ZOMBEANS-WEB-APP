// Web Push service worker. Supplements the in-tab realtime alert system
// (audio + toast) with OS-level notifications when the tab is backgrounded,
// the phone is locked, or the site isn't open. See
// docs/web-push-notifications.md for the design.

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
    badge: "/icon.png",
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
