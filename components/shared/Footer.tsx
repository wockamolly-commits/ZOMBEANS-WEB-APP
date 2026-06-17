import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-zb-primary-dark text-zb-cream/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-3xl tracking-wide text-zb-cream">ZOMBEANS</p>
          <p className="mt-1 text-xs tracking-[0.18em] text-zb-cream/60">RISE UP FROM THE DEAD</p>
          <p className="mt-4 text-sm max-w-md leading-relaxed">
            Premium coffee, matcha, rice bowls and croffles in San Carlos City.
            Some cafés wake you up. We bring you back to life.
          </p>
        </div>
        <div>
          <p className="font-semibold text-zb-cream mb-3">Visit</p>
          <p className="text-sm leading-relaxed">
            San Julio Subdivision, Nangka St,
            <br />
            Barangay 2, San Carlos City
            <br />
            6127 Negros Occidental
          </p>
          <p className="mt-3 text-sm">Open all week · 7 AM – 10 PM</p>
        </div>
        <div>
          <p className="font-semibold text-zb-cream mb-3">Connect</p>
          <ul className="text-sm space-y-2">
            <li><Link href="/menu" className="hover:text-zb-cream">Menu</Link></li>
            <li><Link href="/about" className="hover:text-zb-cream">About</Link></li>
            <li><Link href="/contact" className="hover:text-zb-cream">Contact</Link></li>
            <li><a href="tel:+639186056360" className="hover:text-zb-cream">0918 605 6360</a></li>
            <li><a href="https://facebook.com/ZombeansOfficial" className="hover:text-zb-cream" target="_blank" rel="noreferrer">@ZombeansOfficial</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 text-xs text-zb-cream/50 flex flex-col sm:flex-row justify-between gap-2">
          <p>© {new Date().getFullYear()} Zombeans Café. All rights reserved.</p>
          <p>Built with love and questionable amounts of caffeine.</p>
        </div>
      </div>
    </footer>
  );
}
