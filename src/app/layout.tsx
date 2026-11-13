import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
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
  themeColor: "#101413",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "oklch(0.2 0.005 170)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.965 0.003 170)",
            },
          }}
        />
      </body>
    </html>
  );
}
