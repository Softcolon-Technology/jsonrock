"use client";

import Navbar from "@/components/navbar";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ShowcaseSection from "@/components/showcase-section";
import ProductivitySection from "@/components/productivity-section";
import Footer from "@/components/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="bg-[#fafafa]">
        <HeroSection />

        <FeaturesSection />
      </div>

      <ShowcaseSection />

      <ProductivitySection />

      <Footer />
    </div>
  );
}
