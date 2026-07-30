/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getAllWebsiteBlogSlugs,
  getWebsiteBlogBySlug,
  WEBSITE_BLOG_CATEGORY_LABEL,
  websiteBlogCategoryClass
} from "@/app/website/website-blogs-data";
import { ExternalImage } from "@/components/external-image";
import { Button } from "@/components/ui/button";
import { WebsiteLogo } from "@/app/website/_components/website-logo";
import { WebsiteTopNav } from "@/app/website/_components/website-top-nav";
import { WebsiteFooter } from "@/app/website/_components/website-footer";

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return getAllWebsiteBlogSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const post = getWebsiteBlogBySlug(params.slug);

  if (!post) {
    return { title: "Blog not found" };
  }

  return {
    title: `${post.title} | Dr Nasir Academy`,
    description: post.excerpt
  };
}

export default function BlogDetailPage({ params }: PageProps) {
  const post = getWebsiteBlogBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <WebsiteTopNav active="blogs" />

      <main className="flex-1">
        <article className="surface-panel overflow-hidden">
          <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10">
            <div className="space-y-5">
              <span className={websiteBlogCategoryClass(post.category)}>
                {WEBSITE_BLOG_CATEGORY_LABEL[post.category]}
              </span>
              <h1 className="max-w-4xl text-balance font-display text-[3rem] leading-[0.96] text-foreground md:text-[4.5rem]">
                {post.title}
              </h1>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{post.date}</p>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
            </div>

            <ExternalImage
              src={post.image}
              alt={post.imageAlt}
              className="max-h-[28rem] w-full rounded-[28px] object-cover shadow-[0_24px_80px_-40px_hsl(var(--foreground)/0.35)]"
              width={1000}
              height={560}
            />

            <div className="grid gap-8 lg:grid-cols-[0.78fr_0.22fr]">
              <div className="space-y-5">
                {post.body.map((paragraph, index) => (
                  <p key={index} className="text-[1.05rem] leading-8 text-foreground/90">
                    {paragraph}
                  </p>
                ))}
              </div>

              <aside className="space-y-4">
                <div className="surface-panel-subtle px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Read with intent</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use this note as a study prompt, then carry the lesson into your next timed practice block.
                  </p>
                </div>
                <div className="surface-panel-subtle px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Next move</p>
                  <Button asChild className="mt-3 w-full rounded-full">
                    <Link href="/auth/register">
                      Start account
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </article>
      </main>
      <WebsiteFooter />
    </div>
  );
}
