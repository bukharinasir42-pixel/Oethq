export type WebsiteBlogCategory = "reading" | "speaking" | "writing" | "listening";

export type WebsiteBlogPost = {
    slug: string;
    title: string;
    excerpt: string;
    image: string;
    imageAlt: string;
    category: WebsiteBlogCategory;
    date: string;
    body: string[];
};

export const WEBSITE_BLOG_CATEGORY_LABEL: Record<WebsiteBlogCategory, string> = {
    reading: "Reading",
    speaking: "Speaking",
    writing: "Writing",
    listening: "Listening",
};

export function websiteBlogCategoryClass(cat: WebsiteBlogCategory): string {
    switch (cat) {
        case "reading":
            return "inline-block text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded";
        case "speaking":
            return "inline-block text-xs text-green-700 bg-green-50 px-2 py-1 rounded";
        case "writing":
            return "inline-block text-xs text-pink-700 bg-pink-50 px-2 py-1 rounded";
        case "listening":
            return "inline-block text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded";
        default:
            return "inline-block text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded";
    }
}

export function blogTypeToWebsiteCategory(type: string): WebsiteBlogCategory {
    const lower = type.toLowerCase();
    if (lower === "reading" || lower === "speaking" || lower === "writing" || lower === "listening") {
        return lower;
    }
    return "reading";
}

export const WEBSITE_BLOG_POSTS: WebsiteBlogPost[] = [
    {
        slug: "oet-reading-5-essential-tips",
        title: "OET Reading: 5 Essential Tips",
        excerpt:
            "Discover key strategies to improve your OET Reading score with our practical, proven tips.",
        image: "https://images.unsplash.com/photo-1503676382389-4809596d5290?auto=format&fit=crop&w=500&q=80",
        imageAlt: "OET Reading: 5 Essential Tips",
        category: "reading",
        date: "Mar 15, 2026",
        body: [
            "OET Reading rewards method as much as vocabulary. Start by skimming each text for structure—headings, bullet points, and the first sentence of each paragraph—before you tackle the questions.",
            "Match questions to the order of the passage when possible. This saves time and reduces the risk of re-reading entire sections.",
            "Watch for paraphrasing: correct answers rarely copy the passage word-for-word. Build a habit of linking synonyms between the prompt and the text.",
            "Leave the toughest gap-fill or matching items for a second pass once you have secured easier marks.",
            "Finally, practise under timed conditions so you internalise pacing. Consistent timing is one of the fastest ways to lift your score.",
        ],
    },
    {
        slug: "ace-your-oet-speaking",
        title: "Ace Your OET Speaking",
        excerpt:
            "Step-by-step guidance to excel in OET Speaking, with real examiner insights.",
        image: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=500&q=80",
        imageAlt: "Ace Your OET Speaking",
        category: "speaking",
        date: "Mar 8, 2026",
        body: [
            "The OET Speaking role-play is clinical, not casual. Open each task with a clear professional greeting and confirm the patient’s concern before offering advice.",
            "Use a structured flow: clarify → explain → check understanding. This mirrors real healthcare communication and helps you hit the assessment criteria.",
            "Avoid long monologues. Short turns with natural follow-up questions show interaction skills and keep you within time.",
            "Record yourself against official prompts and listen for clarity, pace, and medical accuracy—not accent perfection.",
            "Build a small bank of phrases for empathy, explaining procedures, and closing conversations so you are never stuck searching for words on test day.",
        ],
    },
    {
        slug: "writing-task-common-mistakes",
        title: "Writing Task: Common Mistakes",
        excerpt: "Avoid the top 7 errors most OET candidates make in the writing module.",
        image: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=500&q=80",
        imageAlt: "Writing Task: Common Mistakes",
        category: "writing",
        date: "Feb 28, 2026",
        body: [
            "Many candidates lose marks by misreading the reader and purpose. Underline the task instructions and keep every paragraph focused on that single scenario.",
            "Mixing letter and email conventions—such as wrong salutation or sign-off—is a frequent slip. Memorise one reliable template for each genre you might face.",
            "Over-long introductions eat word count without adding clinical value. Move quickly to the reason for writing and the key actions requested.",
            "Vague clinical detail weakens your case. Use specific, plausible information from the case notes rather than generic statements.",
            "Grammar and cohesion still matter: paragraph breaks, referencing, and consistent tense help examiners follow your argument with less effort.",
            "Always allow two minutes for a proofread pass. Catching spelling of drug names and patient details can save your grade.",
            "Practise with expert feedback so you learn which mistakes you repeat; targeted correction beats writing ten unchecked letters.",
        ],
    },
];

export function getWebsiteBlogBySlug(slug: string): WebsiteBlogPost | undefined {
    return WEBSITE_BLOG_POSTS.find(p => p.slug === slug);
}

export function getAllWebsiteBlogSlugs(): string[] {
    return WEBSITE_BLOG_POSTS.map(p => p.slug);
}
