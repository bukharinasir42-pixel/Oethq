"use client";

import { useEffect, useState } from "react";
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { OethqProofBanner } from "./oethq-proof-banner";
import { OethqStoriesSlider } from "./oethq-stories-slider";
import { OethqCalibrate } from "./oethq-calibrate";
import { OethqFounderTeam } from "./oethq-founder-team";
import { OethqFooter } from "./oethq-footer";
import { OethqNav } from "./oethq-nav";
import { WebsiteStruggleFormDialog } from "./website-struggle-form-dialog";
import { WebsiteCourseCatalogue } from "./website-course-catalogue";
import { WebsiteWhatsInside } from "./website-whats-inside";
import { OethqExplanations } from "./oethq-explanations";
import { CompleteCourseLanding } from "./complete-course-landing";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import "./website.css";
import "./oethq-home.css";

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--font-oethq-sans",
});

const inter = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--font-oethq-inter",
});

const sora = Sora({
    subsets: ["latin"],
    weight: ["400", "600", "700", "800"],
    display: "swap",
    variable: "--font-oethq-display",
});

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    display: "swap",
    variable: "--font-oethq-mono",
});

/** Fallback embed if the API is unavailable. Prefer `/embed/` — `/play/` is a full player page, not an iframe source. */
const HERO_BUNNY_EMBED_FALLBACK =
    "https://iframe.mediadelivery.net/embed/697843/e62723b1-a68d-445e-a821-0bc3ec7a1ea4?autoplay=true&muted=true&preload=true";

export default function WebsiteHomePage() {
    const [heroEmbedUrl, setHeroEmbedUrl] = useState<string>(HERO_BUNNY_EMBED_FALLBACK);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const response = await apiFetch<{ embedUrl: string }>(
                    "/website/home-video/embed",
                    { token: null }
                );
                if (!cancelled && response.embedUrl) {
                    setHeroEmbedUrl(response.embedUrl);
                }
            } catch {
                // Keep unsigned fallback embed URL.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const scrollToHash = () => {
            const hash = window.location.hash;
            if (!hash || hash === "#top") return;
            const el = document.querySelector(hash);
            if (!el) return;
            requestAnimationFrame(() => {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        };

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        return () => window.removeEventListener("hashchange", scrollToHash);
    }, []);

    return (
        <main
            className={cn(
                plusJakarta.className,
                plusJakarta.variable,
                inter.variable,
                sora.variable,
                ibmPlexMono.variable,
                "website-page oethq-home oethq-rest bg-white text-slate-900"
            )}
        >
            <OethqNav />

            {/* ===== WHITE CENTERED BANNER (intro video) ===== */}
            <header className="website-hero" id="top">
                <div className="website-hero__inner">
                    <p className="website-hero__eyebrow">Your Partner in OET</p>
                    <h1 className="website-hero__title">
                        Tired of Watching Others <em>Fly Abroad</em> While You Stay Stuck In OET?
                    </h1>
                    <p className="website-hero__sub">
                        1,000+ Doctors and Nurses were stuck too until they discovered the N.A.S.I.R OET system.
                    </p>

                    <div className="website-hero__media">
                        <div className="website-hero__video">
                            <iframe
                                key={heroEmbedUrl}
                                className="website-hero__video-el"
                                src={heroEmbedUrl}
                                title="Dr Nasir Academy Introduction"
                                loading="eager"
                                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== REFERENCE SITE SECTIONS ===== */}
            <div>
                <OethqProofBanner
                    cta={
                        <WebsiteStruggleFormDialog
                            trigger={
                                <button type="button" className="cta">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.16-1.35A10 10 0 1 0 12 2zm5.47 14.13c-.23.65-1.35 1.24-1.86 1.28-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.67-4.08-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.13.3-.27.46-.14.16-.28.36-.4.48-.13.13-.27.28-.12.54.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.58.75 1.85.88.27.14.45.2.52.32.06.11.06.65-.17 1.28z" />
                                    </svg>
                                    Enroll on WhatsApp
                                </button>
                            }
                        />
                    }
                />

                <div id="stories">
                    <OethqStoriesSlider />
                </div>

                <OethqCalibrate />

                <WebsiteCourseCatalogue />

                <WebsiteWhatsInside />

                {/* The explanation walkthrough. Its own section rather than a
                    line in a feature list: it is the thing no other academy
                    has, and it is easier to show than to describe. */}
                <OethqExplanations />

                {/* Homepage "clearance" slot now shows the Complete Material plan
                    cards + comparison table (the /courses landing), embedded. */}
                <CompleteCourseLanding embedded anchorId="pricing" />

                {/* Founder/team is desktop/laptop only — hidden on phones. */}
                <div className="hp-desktop-only">
                    <OethqFounderTeam />
                </div>

                <OethqFooter />
            </div>
        </main>
    );
}
