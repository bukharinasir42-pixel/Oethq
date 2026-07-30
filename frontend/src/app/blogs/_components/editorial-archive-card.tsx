import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { WebsiteBlogPost, WebsiteBlogCategory } from "@/app/website/website-blogs-data";
import { WEBSITE_BLOG_CATEGORY_LABEL } from "@/app/website/website-blogs-data";
import { cn } from "@/lib/utils";

function archiveCategoryTone(cat: WebsiteBlogCategory): string {
  switch (cat) {
    case "reading":
      return "border-sky-400/35 bg-sky-400/15 text-sky-100";
    case "speaking":
      return "border-emerald-400/35 bg-emerald-400/15 text-emerald-100";
    case "writing":
      return "border-rose-400/35 bg-rose-400/15 text-rose-100";
    case "listening":
      return "border-amber-400/35 bg-amber-400/15 text-amber-100";
    default:
      return "border-white/20 bg-white/10 text-[#f8f1e4]";
  }
}

export function EditorialArchiveCard({ post, styleDelayMs = 0 }: { post: WebsiteBlogPost; styleDelayMs?: number }) {
  return (
    <Link
      href={`/blogs/${post.slug}`}
      className={cn(
        "group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[22px] border border-[#1c1914]/[0.08] bg-[#14110d] p-6 text-[#f3ecdf] shadow-[0_24px_60px_-30px_rgba(20,17,13,0.75)] ring-1 ring-white/10 transition duration-300",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500",
        "hover:-translate-y-1 hover:ring-[#b8860b]/40"
      )}
      style={styleDelayMs ? { animationDelay: `${styleDelayMs}ms` } : undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-soft-light"
        style={{
          backgroundImage: `linear-gradient(145deg, transparent 40%, #0d5c5c 100%)`
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-3">
        <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#e8dcc8]">
          Archive
        </span>
        <span
          className={cn(
            "inline-block rounded-md border px-2 py-1 text-xs font-medium",
            archiveCategoryTone(post.category)
          )}
        >
          {WEBSITE_BLOG_CATEGORY_LABEL[post.category]}
        </span>
        <h3 className="font-blog-display text-balance text-2xl leading-[1.1] tracking-[-0.02em] md:text-[1.65rem]">{post.title}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-[#d4cbbf]">{post.excerpt}</p>
      </div>
      <div className="relative z-[1] mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm font-semibold text-[#7ecbc4]">
        <time className="text-xs uppercase tracking-[0.18em] text-[#a89f92]">{post.date}</time>
        <span className="inline-flex items-center gap-1">
          Open
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
