import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono, Sora, Source_Serif_4 } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import "sonner/dist/styles.css";

/** OET HQ — Inter body, Sora headings, Source Serif 4 for reading paper (matches reference) */
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const fontDisplay = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const fontReading = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-reading",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap"
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

/** Premium editorial display serif — used to make marketing course headings pop. */
const fontPremium = Fraunces({
  subsets: ["latin"],
  variable: "--font-premium",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "OET HQ",
  description: "Disciplined OET preparation with OTP-gated access, coaching pathways, and exam-style practice.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontReading.variable} ${fontMono.variable} ${fontPremium.variable}`}
      style={
        {
          "--font-workspace-sans": "var(--font-sans)",
          "--font-workspace-display": "var(--font-display)",
          "--font-portal-sans": "var(--font-sans)",
          "--font-portal-display": "var(--font-display)"
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <body
        className={cn(
          "min-h-dvh overflow-x-hidden bg-background text-foreground antialiased",
          fontSans.className
        )}
      >
        <AppProviders>
          <div className="flex min-h-dvh w-full flex-col">{children}</div>
          <Toaster position="top-center" richColors closeButton />
        </AppProviders>
      </body>
    </html>
  );
}
