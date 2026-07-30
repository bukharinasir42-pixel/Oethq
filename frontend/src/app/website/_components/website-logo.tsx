import { OET_BRAND_LOGO_ALT, OET_BRAND_LOGO_SRC, OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { cn } from "@/lib/utils";

export const WEBSITE_LOGO_SRC = OET_BRAND_LOGO_SRC;
export const WEBSITE_LOGO_ALT = OET_BRAND_LOGO_ALT;

type WebsiteLogoProps = {
  className?: string;
  priority?: boolean;
  linkClassName?: string;
  asLink?: boolean;
};

export function WebsiteLogo({ className, priority, linkClassName, asLink = true }: WebsiteLogoProps) {
  return (
    <OetBrandLogo
      className={cn("w-[150px] max-h-[4.5rem] sm:w-[240px]", className)}
      priority={priority}
      asLink={asLink}
      href="/"
    />
  );
}
