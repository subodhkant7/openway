import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/presentation/Navbar";
import { HeroSection } from "@/components/presentation/HeroSection";
import { ProblemSection } from "@/components/presentation/ProblemSection";
import { HowItWorksSection } from "@/components/presentation/HowItWorksSection";
import { WalkthroughSection } from "@/components/presentation/WalkthroughSection";
import { ArchitectureSection } from "@/components/presentation/ArchitectureSection";
import { SafetyPrivacySection } from "@/components/presentation/SafetyPrivacySection";
import { CtaSection } from "@/components/presentation/CtaSection";
import { Footer } from "@/components/presentation/Footer";

export const metadata: Metadata = {
  title: "OpenWay — Proactive Accessibility Assurance System",
  description:
    "OpenWay is a proactive, event-driven accessibility assurance system that uses Ring evidence to detect configured, camera-observable access interruptions, coordinate remediation, and verify restoration with fresh evidence.",
  keywords: [
    "OpenWay",
    "Accessibility Assurance",
    "Ring Hackathon",
    "AWS Builder",
    "Wheelchair Accessibility",
    "Amazon Bedrock",
    "Physical Access",
    "Deterministic Verification",
  ],
  openGraph: {
    title: "OpenWay — Proactive Accessibility Assurance System",
    description:
      "Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed.",
    url: "https://main.d2qhyx9vstga35.amplifyapp.com/",
    siteName: "OpenWay",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-ow-navy text-ow-paper selection:bg-ow-mint/30 selection:text-ow-paper antialiased">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-ow-panel focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-ow-mint focus:ring-2 focus:ring-ow-mint"
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <WalkthroughSection />
        <ArchitectureSection />
        <SafetyPrivacySection />
        <CtaSection />
      </main>

      <Footer />
    </div>
  );
}
