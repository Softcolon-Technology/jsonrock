import type { Metadata } from "next";
import LandingPage from "./landing-page";

export const metadata: Metadata = {
  title: "JsonRock | Visualize, Format & Validate JSON Instantly",
  description:
    "The most powerful JSON visualization tool for developers. Transform raw JSON into interactive Graphs and Trees. Secure, fast, and 100% free.",
  keywords: [
    "JSON visualizer",
    "JSON formatter",
    "JSON validator",
    "debug JSON",
    "developer tools",
    "data visualization",
  ],
  openGraph: {
    title: "JsonRock | Visualize, Format & Validate JSON Instantly",
    description:
      "The most powerful JSON visualization tool for developers. Transform raw JSON into interactive Graphs and Trees.",
    url: "https://jsonrock.com",
    siteName: "JsonRock",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JsonRock Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JsonRock | Visualize, Format & Validate JSON Instantly",
    description:
      "The most powerful JSON visualization tool for developers. Transform raw JSON into interactive Graphs and Trees.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://jsonrock.com",
  },
};

export default function Home() {
  return <LandingPage />;
}
