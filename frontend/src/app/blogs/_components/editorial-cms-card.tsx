import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlogDto } from "@/lib/types";
import { stripHtml } from "@/lib/html";
import {
  WEBSITE_BLOG_CATEGORY_LABEL,
  blogTypeToWebsiteCategory,
  websiteBlogCategoryClass
} from "@/app/website/website-blogs-data";
import { ExternalImage } from "@/components/external-image";
import { cn } from "@/lib/utils";

export function EditorialCmsCard({ post, styleDelayMs = 0 }: { post: BlogDto; styleDelayMs?: number }) {
  const cat = blogTypeToWebsiteCategory(post.blogType);
  const plain = stripHtml(post.description);
  const preview = plain.length > 150 ? `${plain.slice(0, 147)}…` : plain;
  const img = post.imageUrl || "/images/logo.png";
  const dateLabel = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <Link
      href={`/blogs/p/${post.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[22px] border border-[#1c1914]/[0.08] bg-[#fdfbf7]/95 shadow-[0_22px_60px_-34px_rgba(20,17,13,0.55)] ring-1 ring-white/60 backdrop-blur-sm transition duration-300",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500",
        "hover:-translate-y-1 hover:border-[#0d5c5c]/25 hover:shadow-[0_28px_70px_-28px_rgba(13,92,92,0.35)]"
      )}
      style={styleDelayMs ? { animationDelay: `${styleDelayMs}ms` } : undefined}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e8e0d4]">
        <ExternalImage
          src={img}
          alt=""
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14110d]/45 via-transparent to-transparent opacity-80" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6 md:p-7">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#5c564c]">
          {dateLabel ? <time dateTime={post.publishedAt ?? undefined}>{dateLabel}</time> : null}
          {dateLabel ? <span aria-hidden className="text-[#b8860b]">·</span> : null}
          <span className={websiteBlogCategoryClass(cat)}>{WEBSITE_BLOG_CATEGORY_LABEL[cat]}</span>
        </div>
        <h2 className="font-blog-display text-balance text-[1.55rem] leading-[1.12] tracking-[-0.02em] text-[#14110d] md:text-[1.75rem]">
          {post.title}
        </h2>
        <p className="line-clamp-3 flex-1 text-[0.95rem] leading-relaxed text-[#4a4338]">{preview}</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0d5c5c]">
          Read article
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
