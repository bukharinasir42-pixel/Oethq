"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CandidateActivePlanHomeRedirect } from "./_components/candidate-active-plan-home-redirect";
import { MaterialsNavMenu } from "./_components/materials-nav-menu";
import { WebsiteAuthActions } from "./_components/website-auth-actions";
import { WebsiteTrialCta } from "./_components/website-trial-cta";
import "./oethq-home.css";

export function OethqNav() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const close = () => setOpen(false);

    return (
        <>
        <CandidateActivePlanHomeRedirect />
        <nav className="hp-nav">
            <div className="hp-nav-in">
                <Link className="hp-logo" href="/" onClick={close}>
                    <img src="/images/oethq/logo.png" alt="OET HQ" />
                </Link>

                <button
                    type="button"
                    className="hp-burger"
                    aria-label={open ? "Close menu" : "Open menu"}
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                            <path d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    )}
                </button>

                <div className={`hp-links${open ? " open" : ""}`} id="hpLinks">
                    <MaterialsNavMenu onNavigate={close} />
                    <Link href="/#whats-inside" onClick={close}>
                        What&apos;s inside
                    </Link>
                    <Link href="/stories" onClick={close}>
                        Success Stories
                    </Link>
                    <Link href="/blogs" onClick={close}>
                        Blogs
                    </Link>
                    <Link href="/#pricing" onClick={close}>
                        Pricing
                    </Link>
                    <Link href="/about" onClick={close}>
                        About Us
                    </Link>
                    <Link href="/contact" onClick={close}>
                        Contact Us
                    </Link>

                    <span className="hp-nav-auth-desktop">
                        <WebsiteTrialCta />
                        <WebsiteAuthActions appearance="oethq" />
                    </span>
                    <span className="hp-nav-auth-mobile">
                        <WebsiteTrialCta onNavigate={close} />
                        <WebsiteAuthActions appearance="oethq" variant="mobile" onNavigate={close} />
                    </span>
                </div>
            </div>
        </nav>
        </>
    );
}
