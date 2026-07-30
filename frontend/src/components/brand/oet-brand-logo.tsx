import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const OET_BRAND_LOGO_SRC = "/images/logo-oet-hq.png";
export const OET_BRAND_LOGO_ALT = "OET HQ";

type OetBrandLogoProps = {
  className?: string;
  priority?: boolean;
  href?: string;
  asLink?: boolean;
};

export function OetBrandLogo({
  className,
  priority,
  href = "/",
  asLink = true
}: OetBrandLogoProps) {
  const image = (
    <Image
      src={OET_BRAND_LOGO_SRC}
      alt={OET_BRAND_LOGO_ALT}
      width={376}
      height={120}
      className={cn("h-auto w-[140px] max-h-14 object-contain object-left sm:w-[180px]", className)}
      priority={priority}
    />
  );

  if (!asLink) {
    return image;
  }

  return (
    <Link href={href} className="inline-flex shrink-0 items-center no-underline">
      {image}
    </Link>
  );
}
