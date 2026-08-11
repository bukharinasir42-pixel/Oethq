import "./oethq-home.css";

type WhyCard = {
    title: string;
    body: string;
    path: string;
};

const WHY_CARDS: WhyCard[] = [
    {
        title: "Teaching Approach",
        body: "Skills first, tricks second. We teach how examiners actually score before we teach how you answer — with dedicated depth in Reading & Listening, where most candidates lose their B.",
        path: "M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5",
    },
    {
        title: "2026 Calibrated Mock Tests",
        body: "$60,000+ invested in fresh, examiner-calibrated mocks at the real 2026 difficulty. Nothing recycled, nothing you've already seen circulating in Telegram groups.",
        path: "M12 8v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z",
    },
    {
        title: "Every Reading Answer Explained",
        body: "Not an answer key. Submit any Reading test or past paper and Dr Nasir walks you through it question by question — the sentence the answer came from highlighted in the passage, and the exact phrase that broke the option you chose.",
        path: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z",
    },
    {
        title: "Core Skill Development",
        body: "Skimming, scanning, inference, paraphrase-spotting, distractor elimination — trained as measurable skills with drills and benchmarks, not vague \"read more\" advice.",
        path: "M2 20h20M5 20V8.5L12 4l7 4.5V20M9 20v-6h6v6",
    },
    {
        title: "Accountability & Tracking",
        body: "Your progress lives on data, not motivation. WhatsApp accountability groups run personally by Dr. Nasir keep you moving when discipline dips.",
        path: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    },
    {
        title: "Reading & Listening Cheat Sheets",
        body: "Condensed B/C-grade patterns distilled from thousands of scored attempts — the legitimate shortcuts that separate a 340 from a 360.",
        path: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M9 13h6M9 17h6",
    },
    {
        title: "Four Live Classes a Week, Your Hours",
        body: "You choose four weekdays and set the time for each one, with two sessions on every class day. Real papers solved live with instructors, on a timetable built around your roster rather than against it.",
        path: "M23 7l-7 5 7 5V7ZM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z",
    },
    {
        title: "Writing Letter Correction",
        body: "Human corrections marked against the official criteria with line-by-line feedback — a real assessor's eye, not an automated score.",
        path: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
    },
    {
        title: "Success Transparency",
        body: "Real screenshots, verifiable results, reviews in the open on Trustpilot. If a claim can't be proven, we don't make it — that's the whole policy.",
        path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
    },
];

export function OethqWhy() {
    return (
        <section className="hp-why" id="why">
            <div className="hp-sec-head">
                <div className="hp-eyebrow">Why We&apos;re Different</div>
                <h2>
                    The OET HQ <em>Comparison</em>
                </h2>
                <p>What is a self-made teacher vs. an engineered system? This is everything academies hope you never ask.</p>
            </div>
            <div className="hp-why-grid">
                {WHY_CARDS.map((card) => (
                    <div className="hp-wcard" key={card.title}>
                        <span className="hp-wic">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d={card.path} />
                            </svg>
                        </span>
                        <div>
                            <b>{card.title}</b>
                            <p>{card.body}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
