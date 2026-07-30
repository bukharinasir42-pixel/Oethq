import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  WEBSITE_BLOG_CATEGORY_LABEL,
  blogTypeToWebsiteCategory
} from "@/app/website/website-blogs-data";
import { OethqFooter } from "@/app/website/oethq-footer";
import { OethqNav } from "@/app/website/oethq-nav";
import { Button } from "@/components/ui/button";
import { ExternalImage } from "@/components/external-image";
import { apiFetch } from "@/lib/api";
import { isHtmlEmpty, stripHtml } from "@/lib/html";
import type { PublicBlogDetailDto } from "@/lib/types";
import { BlogCmsHtml } from "../../_components/blog-cms-html";

type PageProps = {
  /** Next 15+ may pass a Promise; `Promise.resolve` supports both. */
  params: { id: string } | Promise<{ id: string }>;
};

async function resolvePostId(params: PageProps["params"]): Promise<string> {
  const p = await Promise.resolve(params);
  return p.id;
}

function isPublicBlogDetailDto(v: unknown): v is PublicBlogDetailDto {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.title === "string" && !("items" in o);
}

async function loadPostUncached(id: string): Promise<PublicBlogDetailDto | null> {
  try {
    const qs = new URLSearchParams({ id });
    const data = await apiFetch<unknown>(`/blogs/public?${qs.toString()}`);
    return isPublicBlogDetailDto(data) ? data : null;
  } catch {
    return null;
  }
}

const loadPost = cache(loadPostUncached);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = await resolvePostId(params);
  const post = await loadPost(id);
  if (!post) {
    return { title: "Article | Dr Nasir Academy" };
  }
  const plain = stripHtml(post.description);
  return {
    title: `${post.title} | Dr Nasir Academy`,
    description: plain.length > 160 ? `${plain.slice(0, 157)}…` : plain || undefined
  };
}

export default async function PublicBlogArticlePage({ params }: PageProps) {
  const id = await resolvePostId(params);
  const post = await loadPost(id);
  if (!post) {
    notFound();
  }

  const cat = blogTypeToWebsiteCategory(post.blogType);
  const image = post.imageUrl || "/images/logo.png";
  const dateLabel = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" })
    : null;
  const hasBody = post.content && !isHtmlEmpty(post.content);

  return (
    <>
      <OethqNav />

      <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-8 md:pt-12">
        <Link
          href="/blogs"
          className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[var(--hp-blue-deep)] underline-offset-4 transition hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All articles
        </Link>

        <article className="overflow-hidden rounded-[28px] border border-[var(--hp-line)] bg-white shadow-[0_24px_60px_-28px_rgba(13,42,90,0.28)]">
          <div className="relative aspect-[21/9] min-h-[200px] w-full bg-[#eaf2fe] md:aspect-[2.4/1]">
            <ExternalImage src={image} alt="" className="h-full w-full object-cover" loading="eager" />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[var(--hp-navy)]/55 via-[var(--hp-navy)]/10 to-transparent"
              aria-hidden
            />
          </div>

          <div className="grid gap-10 px-6 py-10 md:grid-cols-[1fr_220px] md:gap-12 md:px-12 md:py-12">
            <div className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--hp-ink-faint)]">
                <span className="hp-bcat">{WEBSITE_BLOG_CATEGORY_LABEL[cat]}</span>
                {dateLabel ? (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={post.publishedAt ?? undefined}>{dateLabel}</time>
                  </>
                ) : null}
              </div>

              <h1 className="text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--hp-navy)]" style={{ fontFamily: "var(--hp-font-display)" }}>
                {post.title}
              </h1>

              <div className="border-l-[3px] border-[var(--hp-blue)]/50 pl-5">
                <BlogCmsHtml html={post.description} variant="lede" />
              </div>

              {hasBody ? (
                <div className="border-t border-[var(--hp-line)] pt-10">
                  <h2 className="sr-only">Article</h2>
                  <BlogCmsHtml html={post.content!} variant="body" />
                </div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-6 border-t border-[var(--hp-line)] pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <div className="rounded-2xl border border-[var(--hp-line)] bg-[#eaf2fe]/60 p-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--hp-blue-deep)]">Study rhythm</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--hp-ink-soft)]">
                  Pair this read with a timed practice block—same module, same stamina you will need on test day.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--hp-line)] bg-[#f7fafc] p-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--hp-ink-faint)]">Next step</p>
                <Button asChild className="mt-4 w-full rounded-full bg-[var(--hp-blue)] text-white hover:bg-[var(--hp-blue-deep)]">
                  <Link href="/auth/register">
                    Create account
                    <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </aside>
          </div>
        </article>
      </main>

      <OethqFooter />
    </>
  );
}
