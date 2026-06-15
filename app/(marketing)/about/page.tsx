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
          <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">ABOUT</p>
            <h1 className="font-display text-5xl sm:text-6xl text-zb-cream mt-2 leading-none">
              Brew. Brain. Bite.
            </h1>
            <p className="mt-4 text-xl italic text-zb-cream/90">
              Some cafés wake you up. We bring you back to life.
            </p>
            <div className="mt-8 space-y-5 text-zb-cream/85 leading-relaxed">
              <p>
                ZomBeans started in <strong className="text-zb-cream">2021</strong> in
                San Carlos City, when Mark Hibionada decided the city needed a café
                that took its coffee seriously without taking itself seriously. The
                name? Half a love letter to the bean, half a wink at every
                undercaffeinated soul stumbling in before 9 a.m. looking for a pulse.
              </p>
              <p>
                What we serve is the easy part — signature drinks built around
                our house syrups, matcha whisked the slow way, rice bowls and
                croffles plated on our signature green ceramic, and bestsellers
                we'll fight you about (the Zomboss, mostly). What we're really
                after is the ten minutes you spend with the cup in your hand:
                feet up, brain on, the playlist a little louder than it needs
                to be.
              </p>
              <p>
                If you've already been here, you know. If you haven't — pull up
                a chair. The dead don't bite. (The croffles do.)
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
              <div className="mt-4 space-y-1.5 text-sm text-zb-cream/85">
                <p>🕒 Open all week · 7 AM – 10 PM</p>
                <p>📱 <a className="hover:text-zb-cream" href="tel:+639186056360">0918 605 6360</a></p>
                <p>📘 <a className="hover:text-zb-cream" href="https://facebook.com/ZombeansOfficial" target="_blank" rel="noreferrer">@ZombeansOfficial</a></p>
              </div>
            </div>
          </section>
        </DoodleBg>
      </main>
      <Footer />
    </>
  );
}
