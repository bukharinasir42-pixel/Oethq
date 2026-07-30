import Link from "next/link";
import { stripHtml } from "@/lib/html";
import type { BlogDto } from "@/lib/types";
import type { WebsiteBlogPost } from "./website-blogs-data";
import { WEBSITE_BLOG_CATEGORY_LABEL, blogTypeToWebsiteCategory, websiteBlogCategoryClass } from "./website-blogs-data";

type WebsiteBlogCardProps = {
    post: WebsiteBlogPost;
};

function estimateReadMinutes(text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
}

export function WebsiteBlogCard({ post }: WebsiteBlogCardProps) {
    return (
        <Link
            href={`/blogs/${post.slug}`}
            className="block rounded-xl border border-slate-200 bg-white shadow transition hover:shadow-lg"
        >
            <img
                src={post.image}
                alt={post.imageAlt}
                className="h-48 w-full rounded-t-xl object-cover"
                width={500}
                height={320}
            />
            <div className="p-5">
                <h3 className="mb-2 text-xl font-semibold text-[#223469]">{post.title}</h3>
                <p className="mb-4 text-sm text-slate-600">{post.excerpt}</p>
                <span className={websiteBlogCategoryClass(post.category)}>
                    {WEBSITE_BLOG_CATEGORY_LABEL[post.category]}
                </span>
            </div>
        </Link>
    );
}

type WebsiteApiBlogCardProps = {
    post: BlogDto;
    /** Match reference blog cards (`.hp-bcard`). */
    variant?: "default" | "oethq";
};

export function WebsiteApiBlogCard({ post, variant = "default" }: WebsiteApiBlogCardProps) {
    const cat = blogTypeToWebsiteCategory(post.blogType);
    const plain = stripHtml(post.description);
    const excerpt = plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
    const img = post.imageUrl || "/images/logo.png";
    const minutes = estimateReadMinutes(`${post.title} ${plain}`);
    const label = WEBSITE_BLOG_CATEGORY_LABEL[cat];

    if (variant === "oethq") {
        return (
            <Link href={`/blogs/p/${post.id}`} className="hp-bcard">
                <span className="hp-bcat">{label}</span>
                <b>{post.title}</b>
                <p>{excerpt || "Read the full article on the OET HQ blog."}</p>
                <span className="hp-bmeta">
                    {minutes} min read · {label} Strategy
                </span>
            </Link>
        );
    }

    return (
        <Link
            href={`/blogs/p/${post.id}`}
            className="group block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
            <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img
                    src={img}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    width={500}
                    height={320}
                />
            </div>
            <div className="p-5">
                <h3 className="mb-2 text-xl font-semibold text-[#223469]">{post.title}</h3>
                <p className="mb-4 text-sm text-slate-600">{excerpt}</p>
                <span className={websiteBlogCategoryClass(cat)}>{label}</span>
            </div>
        </Link>
    );
}
