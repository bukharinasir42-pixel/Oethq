import { IBM_Plex_Mono, Inter, Sora } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { OethqAuthBrandPanel } from "./oethq-auth-brand-panel";
import "./oet-hq-login.css";

export const metadata = {
  title: "Account · OET HQ",
  description: "Sign in or create your OET HQ candidate account"
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-oethq-login-sans"
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-oethq-login-display"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-oethq-login-mono"
});

function AuthRouteFallback() {
  return (
    <div className="card" aria-busy="true" aria-label="Loading sign-in">
      <div className="kicker">Welcome back</div>
      <h2>Sign in to your portal</h2>
      <p className="lede">Loading…</p>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        inter.className,
        inter.variable,
        sora.variable,
        ibmPlexMono.variable,
        "oet-hq-login"
      )}
    >
      <OethqAuthBrandPanel />

      <main className="panel">
        <nav className="panel-top">
          <Link href="/">Home</Link>
          <Link href="/blogs">Blogs</Link>
        </nav>

        <div className="panel-main">
          <Suspense fallback={<AuthRouteFallback />}>{children}</Suspense>
        </div>

        <footer className="panel-foot">
          © {new Date().getFullYear()} OET HQ · Built for healthcare professionals in 40+ countries
        </footer>
      </main>
    </div>
  );
}
