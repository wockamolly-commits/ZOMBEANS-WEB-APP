import type { MetadataRoute } from "next";

// Web App Manifest. Required for a true "installed" PWA — and on iOS, Web Push
// is ONLY delivered to a site added to the Home Screen with display
// "standalone". Without this, iPhone background/locked-screen notifications
// cannot work at all. See docs/web-push-notifications.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zombeans — Rise Up From The Dead",
    short_name: "Zombeans",
    description:
      "Order coffee, matcha, rice bowls and croffles for dine-in, pickup, or delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a120b",
    theme_color: "#1a120b",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
