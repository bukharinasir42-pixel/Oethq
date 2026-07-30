import type { Metadata } from "next";
import Link from "next/link";
import { OethqFooter } from "@/app/website/oethq-footer";
import { OethqNav } from "@/app/website/oethq-nav";
import { WebsiteApiBlogCard } from "@/app/website/website-blog-card";
import { apiFetch } from "@/lib/api";
import type { PaginatedPublicBlogsDto } from "@/lib/types";

export const metadata: Metadata = {
  title: "The OET HQ Blog | Strategies, Updates & Honest Advice",
  description:
    "No recycled tips. What we teach inside the system, written down — so you can judge our thinking before you spend a rupee."
};

async function loadPublished(): Promise<PaginatedPublicBlogsDto | null> {
  try {
    return await apiFetch<PaginatedPublicBlogsDto>("/blogs/public?page=1&limit=30", { token: null });
  } catch {
    return null;
  }
}

export default async function BlogsPage() {
  const paginated = await loadPublished();
  const cmsItems = paginated?.items ?? [];
  const cmsError = paginated === null;

  return (
    <>
      <OethqNav />

      <main>
        <section className="hp-blogs">
          <div className="hp-sec-head" style={{ paddingTop: 56 }}>
            <div className="hp-eyebrow">The OET HQ Blog</div>
            <h2>
              Strategies, Updates &amp; <em>Honest Advice</em>
            </h2>
            <p>
              No recycled tips. What we teach inside the system, written down — so you can judge our thinking before
              you spend a rupee.
            </p>
          </div>

          {cmsError ? (
            <p className="px-6 pb-16 text-center text-[var(--hp-ink-soft)]">
              We couldn&apos;t load articles right now.{" "}
              <Link href="/blogs" className="font-semibold text-[var(--hp-blue)]">
                Refresh
              </Link>{" "}
              or try again shortly.
            </p>
          ) : cmsItems.length === 0 ? (
            <p className="px-6 pb-16 text-center text-[var(--hp-ink-soft)]">No blogs found.</p>
          ) : (
            <div className="hp-blog-grid">
              {cmsItems.map((post) => (
                <WebsiteApiBlogCard key={post.id} post={post} variant="oethq" />
              ))}
            </div>
          )}
        </section>
      </main>

      <OethqFooter />
    </>
  );
}
