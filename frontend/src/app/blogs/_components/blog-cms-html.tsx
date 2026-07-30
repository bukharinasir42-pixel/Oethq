import { cn } from "@/lib/utils";

/** TipTap-safe rich text: spacing and lists without @tailwindcss/typography. */
const richBody =
  "max-w-none text-[1.05rem] leading-[1.72] text-[#2a2620] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:font-medium [&_a]:text-[#0d5c5c] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-[#14110d] [&_blockquote]:my-6 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#b8860b]/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-blog-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-[#14110d] [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-blog-display [&_h3]:text-xl [&_h3]:text-[#1c1914]";

const richLede =
  "max-w-none text-[1.2rem] leading-[1.65] text-[#252019] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_a]:font-medium [&_a]:text-[#0d5c5c] [&_a]:underline [&_a]:underline-offset-2";

export function BlogCmsHtml({ html, variant = "body", className }: { html: string; variant?: "body" | "lede"; className?: string }) {
  return (
    <div
      className={cn(variant === "lede" ? richLede : richBody, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
