import type { Metadata } from "next";
import { OperatorDashboard } from "@/components/OperatorDashboard";

export const metadata: Metadata = {
  title: "OpenWay — Interactive Operator Console",
  description:
    "Live interactive operator console for OpenWay. Real-time accessibility assurance, deterministic verification, and scenario runner.",
  openGraph: {
    title: "OpenWay — Interactive Operator Console",
    description:
      "Live interactive operator console for OpenWay. Real-time accessibility assurance, deterministic verification, and scenario runner.",
    url: "https://main.d2qhyx9vstga35.amplifyapp.com/console",
    siteName: "OpenWay",
    type: "website",
  },
};

export default function ConsolePage() {
  return <OperatorDashboard />;
}
