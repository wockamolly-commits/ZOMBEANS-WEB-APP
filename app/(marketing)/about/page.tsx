import Image from "next/image";
import { Clock, MessageCircle, Phone } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <DoodleBg>
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid items-end gap-10 border-b border-zb-sage/25 pb-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.65fr)] lg:gap-16">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-zb-bone" aria-hidden />
                  <p className="text-xs font-bold tracking-[0.28em] text-zb-bone">
                    OUR STORY
                  </p>
                </div>
                <h1 className="font-display mt-5 text-[clamp(3.5rem,8vw,7.5rem)] leading-[0.88] text-zb-cream">
                  REVIVE THE DEAD
                  <span className="mt-2 block text-zb-bone">WITH EVERY SIP.</span>
                </h1>
              </div>

              <aside className="relative overflow-hidden rounded-3xl border border-zb-sage/30 bg-zb-primary-strong/85 p-6 sm:p-8">
                <Image
                  src="/images/brand/zombeans-logo.png"
                  alt=""
                  width={180}
                  height={180}
                  className="absolute -bottom-12 -right-10 size-40 -rotate-12 opacity-[0.08]"
                />
                <p className="font-mono-tabular text-xs font-semibold tracking-[0.2em] text-zb-bone">
                  EST. 2021
                </p>
                <p className="relative mt-5 text-xl font-medium leading-snug text-zb-cream sm:text-2xl">
                  Some cafés wake you up.
                  <span className="mt-1 block italic text-zb-cream/70">
                    We bring you back to life.
                  </span>
                </p>
                <p className="relative mt-6 text-sm leading-relaxed text-zb-cream/65">
                  Born in San Carlos City. Brewed for the undercaffeinated.
                </p>
              </aside>
            </div>

            <div className="mx-auto mt-12 max-w-3xl">
              <div className="space-y-5 text-zb-cream/85 leading-relaxed">
                <p>
                  Zombeans started in <strong className="text-zb-cream">2021</strong> in
                  San Carlos City, when Mark Hibionada decided the city needed a café
                  that took its coffee seriously without taking itself seriously. The
                  name? Half a love letter to the bean, half a wink at every
                  undercaffeinated soul stumbling in before 9 a.m. looking for a pulse.
                </p>
                <p>
                  What we serve is the easy part — signature drinks built around
                  our house syrups, matcha whisked the slow way, rice bowls and
                  croffles plated on our signature green ceramic, and bestsellers
                  we&apos;ll fight you about (the Zomboss, mostly). What we&apos;re really
                  after is the ten minutes you spend with the cup in your hand:
                  feet up, brain on, the playlist a little louder than it needs
                  to be.
                </p>
                <p>
                  If you&apos;ve already been here, you know. If you haven&apos;t — pull up
                  a chair. The dead don&apos;t bite. (The croffles do.)
                </p>
              </div>
              <div className="mt-10 rounded-2xl border border-border bg-card p-6">
                <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">FIND US</p>
                <p className="mt-3 text-zb-cream font-semibold leading-relaxed">
                  San Julio Subdivision, Nangka St
                  <br />
                  Barangay 2, San Carlos City
                  <br />
                  6127 Negros Occidental
                </p>
                <div className="mt-4 space-y-2 text-sm text-zb-cream/85">
                  <p className="flex items-center gap-2.5"><Clock className="size-4 shrink-0 text-zb-bone" /> Mon–Fri 8 AM – 8 PM · Sat–Sun 8 AM – 9 PM</p>
                  <p className="flex items-center gap-2.5"><Phone className="size-4 shrink-0 text-zb-bone" /> <a className="hover:text-zb-cream" href="tel:+639186056360">0918 605 6360</a></p>
                  <p className="flex items-center gap-2.5"><MessageCircle className="size-4 shrink-0 text-zb-bone" /> <a className="hover:text-zb-cream" href="https://facebook.com/ZombeansOfficial" target="_blank" rel="noreferrer">@ZombeansOfficial</a></p>
                </div>
              </div>
            </div>
          </section>
        </DoodleBg>
      </main>
      <Footer />
    </>
  );
}
