"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { OETHQ_STORY_PAIRS } from "./oethq-story-pairs";
import "./oethq-home.css";

const AUTOPLAY_MS = 4500;
const STORY_COUNT = OETHQ_STORY_PAIRS.length;

type LightboxItem = { src: string; kind: "before" | "after" };

const FLAT_ITEMS: LightboxItem[] = OETHQ_STORY_PAIRS.flatMap((pair) => [
    { src: pair.before, kind: "before" as const },
    { src: pair.after, kind: "after" as const },
]);

function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OethqStoriesSlider() {
    const trackRef = useRef<HTMLDivElement>(null);
    const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
    const rafRef = useRef<number | null>(null);

    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbIndex, setLbIndex] = useState(0);

    const center = useCallback((index: number, smooth = true) => {
        const track = trackRef.current;
        const el = slideRefs.current[index];
        if (!track || !el) return;
        const left = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
        track.scrollTo({ left, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
    }, []);

    const goTo = useCallback(
        (index: number) => {
            const next = Math.max(0, Math.min(STORY_COUNT - 1, index));
            setCurrent(next);
            center(next);
        },
        [center]
    );

    useEffect(() => {
        center(0, false);
    }, [center]);

    useEffect(() => {
        const onResize = () => center(current, false);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [current, center]);

    useEffect(() => {
        if (paused || prefersReducedMotion()) return;
        const id = setInterval(() => {
            setCurrent((prev) => {
                const next = prev + 1 >= STORY_COUNT ? 0 : prev + 1;
                center(next);
                return next;
            });
        }, AUTOPLAY_MS);
        return () => clearInterval(id);
    }, [paused, current, center]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const handleScroll = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const centerX = track.scrollLeft + track.clientWidth / 2;
                let best = 0;
                let bestDist = Infinity;
                slideRefs.current.forEach((el, i) => {
                    if (!el) return;
                    const c = el.offsetLeft + el.offsetWidth / 2;
                    const d = Math.abs(c - centerX);
                    if (d < bestDist) {
                        bestDist = d;
                        best = i;
                    }
                });
                setCurrent((prev) => (prev === best ? prev : best));
            });
        };
        track.addEventListener("scroll", handleScroll, { passive: true });
        return () => track.removeEventListener("scroll", handleScroll);
    }, []);

    const openLightbox = useCallback((index: number) => {
        setLbIndex(index);
        setLbOpen(true);
        setPaused(true);
    }, []);

    const closeLightbox = useCallback(() => {
        setLbOpen(false);
        setPaused(false);
    }, []);

    const lbGo = useCallback(
        (delta: number) => {
            setLbIndex((prev) => {
                const next = (prev + delta + FLAT_ITEMS.length) % FLAT_ITEMS.length;
                const slideIndex = Math.floor(next / 2);
                setCurrent(slideIndex);
                center(slideIndex, false);
                return next;
            });
        },
        [center]
    );

    useEffect(() => {
        if (!lbOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowRight") lbGo(1);
            if (e.key === "ArrowLeft") lbGo(-1);
        };
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [lbOpen, closeLightbox, lbGo]);

    const handleTrackKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(current + 1);
        }
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(current - 1);
        }
    };

    const handleSlideClick = (index: number) => (e: ReactMouseEvent<HTMLDivElement>) => {
        const col = (e.target as HTMLElement).closest(".t-col") as HTMLElement | null;
        if (index === current && col) {
            const lbIdx = col.classList.contains("after") ? index * 2 + 1 : index * 2;
            openLightbox(lbIdx);
        } else {
            goTo(index);
        }
    };

    const activeItem = FLAT_ITEMS[lbIndex];

    return (
        <div className="sl-scope">
            <section className="oet-testi">
                <div className="wrap">
                    <div className="t-head">
                        <div className="t-eyebrow">Real Students · Real Messages</div>
                        <h2>
                            You&apos;ve cleared CBT / OSCE / NCLEX / USMLE.
                            <br />
                            <span className="em-a">One English exam froze your future.</span>
                        </h2>
                        <p>
                            Failing again and again on recycled mocks you already know by heart. No OET, no NMC PIN.
                            No PIN, no registration, no visa, no start date depressed, frustrated, watching
                            colleagues fly while your future stays frozen. <b>Every story below started exactly there.</b>{" "}
                            See how it ended.
                        </p>
                    </div>
                </div>

                <div
                    className="t-slider"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <div className="t-fade left" aria-hidden="true" />
                    <div className="t-fade right" aria-hidden="true" />
                    <div
                        className="t-track"
                        ref={trackRef}
                        aria-label="Before and after student success stories"
                        tabIndex={0}
                        onKeyDown={handleTrackKeyDown}
                    >
                        {OETHQ_STORY_PAIRS.map((pair, i) => (
                            <div
                                key={i}
                                ref={(el) => {
                                    slideRefs.current[i] = el;
                                }}
                                className={`t-slide${i === current ? " is-active" : ""}`}
                                onClick={handleSlideClick(i)}
                            >
                                <div className="t-card">
                                    <div className="t-card-top">
                                        <span className="t-verified">
                                            <svg viewBox="0 0 24 24">
                                                <defs>
                                                    <linearGradient id={`vseal${i}`} x1="0" y1="0" x2="1" y2="1">
                                                        <stop offset="0" stopColor="#3d8bf3" />
                                                        <stop offset="1" stopColor="#1f66d0" />
                                                    </linearGradient>
                                                </defs>
                                                <path
                                                    fill={`url(#vseal${i})`}
                                                    d="M12 1.6l2.3 1.9 2.9-.5 1.1 2.8 2.8 1.1-.5 2.9L22.4 12l-1.8 2.3.5 2.9-2.8 1.1-1.1 2.8-2.9-.5L12 22.4l-2.3-1.8-2.9.5-1.1-2.8-2.8-1.1.5-2.9L1.6 12l1.8-2.3-.5-2.9 2.8-1.1 1.1-2.8 2.9.5Z"
                                                />
                                                <path
                                                    fill="none"
                                                    stroke="#fff"
                                                    strokeWidth={2.4}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M8 12.2l2.7 2.7L16.4 9.2"
                                                />
                                            </svg>
                                            Verified conversation
                                        </span>
                                    </div>
                                    <div className="t-pair">
                                        <div className="t-col before">
                                            <div className="t-tag before">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.4-.7L3 21l1.8-5.6a8.38 8.38 0 0 1-.7-3.4 8.5 8.5 0 0 1 8.4-8.5 8.38 8.38 0 0 1 8.5 8Z" />
                                                    <path d="M12 8v3" />
                                                    <circle cx="12" cy="14.5" r=".5" />
                                                </svg>
                                                Before · The struggle
                                            </div>
                                            <div className="t-phone">
                                                <img
                                                    className="t-screen"
                                                    loading="lazy"
                                                    decoding="async"
                                                    src={pair.before}
                                                    alt={`Story ${i + 1}, before: the student's first message asking for help`}
                                                />
                                            </div>
                                        </div>
                                        <div className="t-mid" aria-hidden="true">
                                            <svg viewBox="0 0 58 26">
                                                <defs>
                                                    <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="0" stopColor="#5b9bf5" />
                                                        <stop offset="1" stopColor="#1f66d0" />
                                                    </linearGradient>
                                                </defs>
                                                <path className="t-arrow-line" d="M4 13 H 48 M39 5 l 10 8 -10 8" />
                                            </svg>
                                        </div>
                                        <div className="t-col after">
                                            <div className="t-tag after">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2.6}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                                After · Passed
                                            </div>
                                            <div className="t-phone">
                                                <span className="t-ribbon">
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        strokeWidth={3}
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M20 6 9 17l-5-5" />
                                                    </svg>
                                                    PASSED
                                                </span>
                                                <img
                                                    className="t-screen"
                                                    loading="lazy"
                                                    decoding="async"
                                                    src={pair.after}
                                                    alt={`Story ${i + 1}, after: the same student sharing their passing result`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="t-controls">
                        <button type="button" className="t-arrow" aria-label="Previous story" onClick={() => goTo(current - 1)}>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <div className="t-dots" role="tablist" aria-label="Go to story">
                            {OETHQ_STORY_PAIRS.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`t-dot${i === current ? " on" : ""}`}
                                    aria-label={`Story ${i + 1}`}
                                    onClick={() => goTo(i)}
                                />
                            ))}
                        </div>
                        <button type="button" className="t-arrow" aria-label="Next story" onClick={() => goTo(current + 1)}>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 6l6 6-6 6" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div
                    className={`t-lb${lbOpen ? " open" : ""}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Screenshot, enlarged"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeLightbox();
                    }}
                >
                    <button type="button" className="t-lb-close" aria-label="Close" onClick={closeLightbox}>
                        ✕
                    </button>
                    <button
                        type="button"
                        className="t-lb-nav prev"
                        aria-label="Previous"
                        onClick={() => lbGo(-1)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <div className="t-lb-stage">
                        <img src={activeItem?.src} alt="Student testimonial screenshot" />
                        <span className={`t-lb-cap ${activeItem?.kind ?? "before"}`}>
                            {activeItem?.kind === "after" ? "After — Passed ✓" : "Before — The struggle"}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="t-lb-nav next"
                        aria-label="Next"
                        onClick={() => lbGo(1)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 6l6 6-6 6" />
                        </svg>
                    </button>
                </div>
            </section>
        </div>
    );
}
