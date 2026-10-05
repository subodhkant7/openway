import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenWay — Real-Time Accessibility Assurance",
  description:
    "OpenWay observes configured accessibility conditions using Ring, detects temporary interruptions, coordinates remediation, and independently verifies fresh physical evidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col antialiased selection:bg-sky-500 selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-sky-600 focus:text-white"
        >
          Skip to main content
        </a>
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
