import type { ReactNode } from "react";
import "./oethq-home.css";

type OethqProofBannerProps = {
    cta?: ReactNode;
};

export function OethqProofBanner({ cta }: OethqProofBannerProps) {
    return (
        <div className="pb-scope">
            <section className="banner">
                <div className="wrap">
                    <div className="proof">
                        <a
                            className="pcard"
                            href="https://www.youtube.com/@docnasirofficial"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span className="picon yt">
                                <svg width="27" height="27" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="#FF0000"
                                        d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81z"
                                    />
                                    <path fill="#fff" d="M9.6 15.6V8.4L15.8 12l-6.2 3.6z" />
                                </svg>
                            </span>
                            <span className="pbody">
                                <span className="pnum">
                                    133,580+{" "}
                                    <svg className="ext" viewBox="0 0 24 24">
                                        <path d="M7 17L17 7M9 7h8v8" />
                                    </svg>
                                </span>
                                <span className="plabel">
                                    <b>YouTube subscribers</b> · Let&apos;s Crack OET ~ Dr. Nasir
                                </span>
                            </span>
                        </a>

                        <a
                            className="pcard"
                            href="https://www.trustpilot.com/review/oethq.com"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span className="picon tp">
                                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="#00B67A"
                                        d="M12 1.5l3.06 7.02 7.64.62-5.82 4.98 1.78 7.46L12 17.55l-6.66 4.03 1.78-7.46L1.3 9.14l7.64-.62z"
                                    />
                                </svg>
                            </span>
                            <span className="pbody">
                                <span className="pnum">
                                    4.8
                                    <span className="tstars" aria-label="4.8 out of 5 stars on Trustpilot">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i}>
                                                <svg viewBox="0 0 24 24">
                                                    <path d="M12 1.5l3.06 7.02 7.64.62-5.82 4.98 1.78 7.46L12 17.55l-6.66 4.03 1.78-7.46L1.3 9.14l7.64-.62z" />
                                                </svg>
                                            </span>
                                        ))}
                                    </span>
                                    <svg className="ext" viewBox="0 0 24 24">
                                        <path d="M7 17L17 7M9 7h8v8" />
                                    </svg>
                                </span>
                                <span className="plabel">
                                    <b>Trustpilot</b> · 122 reviews · OET HQ
                                </span>
                            </span>
                        </a>

                        <div className="pcard">
                            <span className="picon gold">
                                <svg
                                    width="26"
                                    height="26"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#F5B944"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="9" r="5.5" />
                                    <path
                                        d="M12 6.4l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.5l2-.3z"
                                        fill="#F5B944"
                                        stroke="none"
                                    />
                                    <path d="M8.8 13.8L7 21l5-2.6L17 21l-1.8-7.2" />
                                </svg>
                            </span>
                            <span className="pbody">
                                <span className="pnum">4 Years</span>
                                <span className="plabel">
                                    <b>of Excellence</b> · in OET training
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="head">
                        <h2>
                            Only Fill The Form If You Are <em>Serious</em> About Clearing OET
                        </h2>
                        {cta ?? (
                            <a className="cta" href="https://wa.me/15109540245">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.16-1.35A10 10 0 1 0 12 2zm5.47 14.13c-.23.65-1.35 1.24-1.86 1.28-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.67-4.08-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.13.3-.27.46-.14.16-.28.36-.4.48-.13.13-.27.28-.12.54.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.58.75 1.85.88.27.14.45.2.52.32.06.11.06.65-.17 1.28z" />
                                </svg>
                                Enroll on WhatsApp
                            </a>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
