import Link from "next/link";
import { WebsiteFooter } from "@/app/website/_components/website-footer";
import { WebsiteTopNav } from "@/app/website/_components/website-top-nav";

export default function BlogArticleNotFound() {
  return (
    <>
      <WebsiteTopNav active="blogs" />
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-blog-display text-3xl tracking-tight text-[#14110d]">Article not found</h1>
        <p className="mt-3 text-[#5c564c]">It may have been unpublished or removed.</p>
        <Link href="/blogs" className="mt-8 inline-block text-sm font-semibold text-[#0d5c5c] underline-offset-4 hover:underline">
          ← Back to the journal
        </Link>
      </main>
      <WebsiteFooter />
    </>
  );
}
