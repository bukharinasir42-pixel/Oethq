import { Heading, Text } from "@radix-ui/themes";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({ eyebrow, title, description, align = "left" }: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", alignment)}>
      {eyebrow ? (
        <span className={cn("editorial-kicker", align === "center" && "mx-auto")}>{eyebrow}</span>
      ) : null}
      <Heading
        size="8"
        className="max-w-3xl text-balance font-display text-[2rem] leading-[0.95] md:text-[3.2rem]"
      >
        {title}
      </Heading>
      {description ? (
        <Text size="3" className="max-w-2xl text-pretty text-muted-foreground md:text-base">
          {description}
        </Text>
      ) : null}
    </div>
  );
}
