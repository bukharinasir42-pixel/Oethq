import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ExternalImage } from "@/components/external-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BlogTeaser } from "@/lib/site-data";
import type { BlogType } from "@/lib/types";

type BlogCardProps = BlogTeaser;

function blogTypeBadgeClass(type: BlogType) {
  switch (type) {
    case "READING":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "SPEAKING":
      return "border-green-100 bg-green-50 text-green-700";
    case "WRITING":
      return "border-pink-100 bg-pink-50 text-pink-700";
    case "LISTENING":
      return "border-violet-100 bg-violet-50 text-violet-800";
    default:
      return "";
  }
}

export function BlogCard({ title, excerpt, href, tag, imageUrl, blogType }: BlogCardProps) {
  const badgeClass = blogType ? blogTypeBadgeClass(blogType) : "text-primary";
  const linkLabel = href === "/blogs" ? "Browse the archive" : "Read article";

  return (
    <Link href={href} className="group block h-full no-underline">
      <Card className="mesh-panel flex h-full overflow-hidden border-white/60 transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_80px_-38px_hsl(var(--primary)/0.35)]">
        {imageUrl ? (
          <div className="aspect-[5/3] w-full overflow-hidden border-b border-border/70 bg-muted">
            <ExternalImage
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          </div>
        ) : null}
        <div className="flex h-full flex-col">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <Badge
                variant="outline"
                className={cn("rounded-full border-white/70 bg-card/70 px-3 py-1", !blogType && "text-primary", blogType && badgeClass)}
              >
                {tag}
              </Badge>
              <div className="rounded-full border border-border/70 bg-card/75 p-2 text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary">
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              </div>
            </div>
            <CardTitle className="font-display text-[1.6rem] leading-tight text-foreground">{title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <CardDescription className="flex-1 text-sm leading-7 text-muted-foreground">{excerpt}</CardDescription>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              {linkLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}
