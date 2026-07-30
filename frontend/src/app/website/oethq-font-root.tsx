import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { cn } from "@/lib/utils";
import "@/app/website/oethq-home.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-oethq-sans"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-oethq-inter"
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-oethq-display"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-oethq-mono"
});

/** Shared font + CSS shell for OET HQ marketing pages (stories, courses, about, blogs). */
export function OethqFontRoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        plusJakarta.className,
        plusJakarta.variable,
        inter.variable,
        sora.variable,
        ibmPlexMono.variable,
        "oethq-home oethq-rest min-h-dvh bg-white text-[var(--hp-ink)]"
      )}
    >
      {children}
    </div>
  );
}
