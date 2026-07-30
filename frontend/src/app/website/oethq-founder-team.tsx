import type { ReactNode } from "react";
import "./oethq-home.css";

type TeamMember = {
    name: string;
    role: ReactNode;
    image: string;
};

const TEAM_MEMBERS: TeamMember[] = [
    {
        name: "Dr. Nasir Bukhari",
        role: (
            <>
                Founder &amp; Executive Director
                <br />
                OET HQ
            </>
        ),
        image: "/images/oethq/team-nasir.jpg",
    },
    {
        name: "Dr. Kalsoom Jahan, PhD",
        role: (
            <>
                Assistant Professor of
                <br />
                Applied Linguistics
            </>
        ),
        image: "/images/oethq/team-kalsoom.jpg",
    },
];

export function OethqFounderTeam() {
    return (
        <>
            <section className="hp-about-head" id="about">
                <div className="hp-sec-head" style={{ marginBottom: 0, paddingTop: 56 }}>
                    <div className="hp-eyebrow">About Us</div>
                    <h2>
                        The People Behind <em>OET HQ</em>
                    </h2>
                    <p>
                        A doctor who lived this exam, a data scientist who engineered the system, and a linguist who
                        knows how English is really scored.
                    </p>
                </div>
            </section>

            <section className="hp-founder">
                <div className="hp-sec-head">
                    <div className="hp-eyebrow">Message From The Founder</div>
                </div>
                <div className="hp-founder-in">
                    <div>
                        <p className="hp-quote">
                            &quot;I built this because <em>no one was being honest</em> with healthcare
                            professionals about OET.&quot;
                        </p>
                        <p className="hp-founder-txt">
                            I watched brilliant doctors and nurses fail an English exam — not because their English
                            was weak, but because they were trained on outdated, recycled material by academies that
                            never studied how this exam is actually scored.
                        </p>
                        <p className="hp-founder-txt">
                            OET HQ is my answer: an engineered system, calibrated against the real 2026 examiner
                            standard, built by a doctor who sat where you&apos;re sitting. We invested in fresh
                            mocks, real analytics, and honest readiness tracking — so the only surprise on exam day
                            is how prepared you feel.
                        </p>
                    </div>
                    <div className="hp-founder-card">
                        <img src="/images/oethq/founder-nasir.jpg" alt="Dr. Nasir Bukhari" />
                        <div className="nm">
                            <b>Dr. Nasir Bukhari</b>
                            <span>Founder &amp; Executive Director, OET HQ</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="hp-team" id="team">
                <div className="hp-sec-head">
                    <div className="hp-eyebrow">Our Team</div>
                    <h2>
                        The Team Behind <em>Your Pass</em>
                    </h2>
                    <p>Doctors and linguists who have lived this exam from both sides of the marking sheet.</p>
                </div>
                <div className="hp-team-grid">
                    {TEAM_MEMBERS.map((member) => (
                        <div className="hp-tcard" key={member.name}>
                            <div className="pic">
                                <img src={member.image} alt={member.name} />
                            </div>
                            <div className="nm">
                                <b>{member.name}</b>
                                <span>{member.role}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
