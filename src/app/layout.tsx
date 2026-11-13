import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/* Geist — precise, modern UI face. Instrument Serif — editorial display voice. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Lovify — Build full-stack apps by prompting, powered by Z.AI",
  description:
    "Lovify turns plain-English ideas into stunning, fully-working web apps in seconds. Describe it, watch it being built, iterate by chat, publish with one click. The AI brain is Z.AI.",
  keywords: [
    "Lovify",
    "AI app builder",
    "Z.AI",
    "prompt to app",
    "no-code",
    "full-stack AI",
    "Lovable alternative",
    "Base44 alternative",
  ],
  authors: [{ name: "faisukhan01" }],
  icons: {
    icon: "/lovify-logo.svg",
  },
  openGraph: {
    title: "Lovify — Prompt it. Build it. Ship it.",
    description:
      "The AI app-builder platform powered by Z.AI. Describe an app, get a working one in seconds.",
    siteName: "Lovify",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "oklch(0.16 0 0)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.97 0.002 90)",
            },
          }}
        />
      </body>
    </html>
  );
}
