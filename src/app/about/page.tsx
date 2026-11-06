import type { Metadata } from "next";
import { AboutScreen } from "@/components/screens/AboutScreen";

export const metadata: Metadata = {
  title: "About · Wallet Maximizer",
  description:
    "Why Wallet Maximizer exists, how to check its suggestions yourself, and how to reach support.",
};

export default function AboutPage() {
  return <AboutScreen />;
}
