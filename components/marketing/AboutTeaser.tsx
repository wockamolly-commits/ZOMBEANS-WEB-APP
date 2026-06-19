import Link from "next/link";
import { Clock, MessageCircle, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { cn } from "@/lib/utils";

export function AboutTeaser() {
  return (
    <DoodleBg className="bg-zb-primary-strong border-y border-border">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 grid gap-8 lg:grid-cols-[1.2fr_1fr] items-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">ABOUT</p>
          <h2 className="font-display mt-2 text-4xl sm:text-5xl text-zb-cream leading-tight">
            Revive the dead with every sip.
          </h2>
          <p className="mt-4 text-zb-cream/90 leading-relaxed text-lg italic">
            Some cafés wake you up. We bring you back to life.
          </p>
          <p className="mt-4 text-zb-cream/80 leading-relaxed">
            Zombeans started in <span className="text-zb-cream font-semibold">2021</span> in San
            Carlos City, when Mark Hibionada decided the city needed a café that
            took its coffee seriously without taking itself seriously.
          </p>
          <p className="mt-3 text-zb-cream/80 leading-relaxed">
            What we&apos;re really after is the ten minutes you spend with the cup
            in your hand: feet up, brain on, the playlist a little louder than
            it needs to be.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/about"
              className={cn(
                buttonVariants(),
                "h-11 px-5 text-base font-semibold bg-zb-bone text-zb-primary-dark hover:bg-zb-bone-soft"
              )}
            >
              Read More
            </Link>
            <Link
              href="/menu"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 px-5 text-base border-zb-sage/40 bg-transparent text-zb-cream hover:bg-zb-primary hover:text-zb-cream"
              )}
            >
              See the Menu
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
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
      </section>
    </DoodleBg>
  );
}
