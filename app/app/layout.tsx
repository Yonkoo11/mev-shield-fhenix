import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "../components/Toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://yonkoo11.github.io/mev-shield-fhenix";

export const metadata: Metadata = {
  title: "MEV Shield | FHE-Encrypted Batch Auctions on Fhenix",
  description:
    "Your trades are noise. FHE-encrypted batch auctions with uniform clearing prices. Zero MEV extraction.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MEV Shield - Your Trades Are Noise",
    description:
      "FHE-encrypted batch auction DEX on Fhenix CoFHE. Orders indistinguishable from random until the clearing price emerges.",
    images: [
      {
        url: `${siteUrl}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: "MEV Shield - FHE-Encrypted Batch Auctions",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MEV Shield - Your Trades Are Noise",
    description:
      "FHE-encrypted batch auctions. Orders sealed. Clearing price computed over ciphertext. Zero MEV.",
    images: [`${siteUrl}/og-image.svg`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceMono.variable} min-h-screen bg-shield-bg antialiased font-sans`}>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
