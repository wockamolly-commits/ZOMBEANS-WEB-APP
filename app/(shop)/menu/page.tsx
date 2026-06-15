import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { STATIC_MENU, getDefaultPriceCents } from "@/lib/menu-static";
import { PesoPrice } from "@/components/shared/PesoPrice";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Menu" };

export default function MenuPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">MENU</p>
          <h1 className="font-display text-4xl sm:text-5xl text-zb-cream mt-2">
            Pick your poison.
          </h1>
          <p className="mt-3 text-zb-cream/75 max-w-2xl">
            Phase 0 preview — a small sample of the live menu while we wire up
            the database. The full menu has 12 categories and ~60 items.
          </p>
        </section>
        {STATIC_MENU.map((cat) => (
          <section key={cat.slug} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <h2 className="font-display text-2xl sm:text-3xl text-zb-cream">{cat.name}</h2>
            <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {cat.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/menu/${item.slug}`}
                  className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-zb-bone/60 transition"
                >
                  <div className="aspect-square bg-zb-cream relative">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-contain p-4 transition-transform group-hover:scale-105"
                    />
                    {item.isBestseller && (
                      <span className="absolute top-2 left-2 rounded-full bg-zb-bone text-zb-primary-dark text-[10px] font-bold tracking-wider px-2 py-0.5">
                        BESTSELLER
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-zb-cream leading-tight">{item.name}</p>
                    <p className="text-xs text-zb-cream/65 mt-0.5 line-clamp-2">{item.description}</p>
                    <p className="mt-2">
                      <PesoPrice cents={getDefaultPriceCents(item)} />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
