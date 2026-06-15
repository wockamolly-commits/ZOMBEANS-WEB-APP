import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">CONTACT</p>
          <h1 className="font-display text-4xl sm:text-5xl text-zb-cream mt-2">Say hi.</h1>
          <p className="mt-3 text-zb-cream/80">We're easiest to reach on Facebook or by phone.</p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 space-y-2 text-zb-cream/90">
            <p>📍 San Julio Subdivision, Nangka St, Barangay 2, San Carlos City</p>
            <p>🕒 7 AM – 10 PM, every day</p>
            <p>📱 <a className="hover:text-zb-cream" href="tel:+639186056360">0918 605 6360</a></p>
            <p>📘 <a className="hover:text-zb-cream" href="https://facebook.com/ZombeansOfficial" target="_blank" rel="noreferrer">@ZombeansOfficial</a></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
