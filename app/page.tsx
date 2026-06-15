import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Hero } from "@/components/marketing/Hero";
import { ServiceModeTiles } from "@/components/marketing/ServiceModeTiles";
import { BestsellerStrip } from "@/components/marketing/BestsellerStrip";
import { AboutTeaser } from "@/components/marketing/AboutTeaser";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <ServiceModeTiles />
        <BestsellerStrip />
        <AboutTeaser />
      </main>
      <Footer />
    </>
  );
}
