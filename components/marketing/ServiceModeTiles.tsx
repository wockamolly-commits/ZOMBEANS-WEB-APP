import Link from "next/link";
import { Utensils, ShoppingBag, Bike } from "lucide-react";

const tiles = [
  {
    href: "/menu?mode=dine_in",
    icon: Utensils,
    title: "Dine-in",
    blurb: "Find a seat, brain on, playlist a little louder than it needs to be.",
  },
  {
    href: "/menu?mode=pickup",
    icon: ShoppingBag,
    title: "Pickup",
    blurb: "Order ahead, breeze in, breeze out. Pick a 15-minute slot.",
  },
  {
    href: "/menu?mode=delivery",
    icon: Bike,
    title: "Delivery",
    blurb: "Within San Carlos. Our rider brings it to your door.",
  },
];

export function ServiceModeTiles() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(({ href, icon: Icon, title, blurb }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-card p-6 transition hover:border-zb-bone/60 hover:bg-zb-primary-strong"
          >
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-zb-primary-strong border border-zb-sage/30 text-zb-bone group-hover:bg-zb-bone group-hover:text-zb-primary-dark transition">
              <Icon className="size-6" />
            </div>
            <h3 className="font-display mt-4 text-2xl text-zb-cream">{title}</h3>
            <p className="mt-1 text-sm text-zb-cream/75 leading-relaxed">{blurb}</p>
            <p className="mt-3 text-xs font-semibold tracking-widest text-zb-bone group-hover:underline">
              CHOOSE THIS →
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
