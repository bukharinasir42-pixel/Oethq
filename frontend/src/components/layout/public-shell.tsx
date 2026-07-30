import Link from "next/link";
import { Button as RadixButton, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { CheckCircle2, Clock3, LockKeyhole, Sparkles } from "lucide-react";
import { OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PublicShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  children: React.ReactNode;
  className?: string;
};

function PublicShellHeader() {
  return <OetBrandLogo className="w-[140px] sm:w-[180px]" />;
}

export function PublicShell({
  eyebrow,
  title,
  description,
  highlights,
  children,
  className
}: PublicShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background font-sans">
      <div className="hero-orb hero-orb-teal left-[-8rem] top-[-8rem] h-72 w-72" />
      <div className="pointer-events-none absolute right-[-7rem] top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,hsl(var(--cyan)/0.16),transparent_70%)] blur-2xl" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 lg:px-8 lg:py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
          <PublicShellHeader />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/blogs">Blogs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Register</Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <section
          className={cn(
            "grid flex-1 grid-cols-1 gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-12",
            "items-start",
            className
          )}
        >
          <div className="min-w-0 space-y-7">
            <div className="space-y-5">
              <div className="editorial-kicker">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <Heading
                size="8"
                className="max-w-3xl text-balance font-display text-[2.5rem] leading-[1.05] tracking-tight text-[hsl(var(--primary-deep))] md:text-[3.25rem]"
              >
                {title}
              </Heading>
              <Text size="4" className="max-w-2xl text-pretty text-muted-foreground md:text-lg">
                {description}
              </Text>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="stat-chip">
                <LockKeyhole className="h-4 w-4 text-primary" aria-hidden />
                Secure OTP verification
              </span>
              <span className="stat-chip">
                <Clock3 className="h-4 w-4 text-primary" aria-hidden />
                60-day access cycles
              </span>
            </div>

            <Grid columns={{ initial: "1", sm: "2" }} gap="3">
              {highlights.map((highlight) => (
                <Card key={highlight} className="border-border shadow-[var(--shadow-card)]">
                  <CardContent className="py-4">
                    <Flex align="start" gap="3">
                      <div className="rounded-full bg-primary/12 p-1.5 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <Text size="2" className="leading-6 text-foreground">
                        {highlight}
                      </Text>
                    </Flex>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          </div>

          <Flex className="min-w-0 w-full" align="start" justify="start">
            <div className="mx-auto w-full max-w-xl space-y-4">
              {children}
              <Card className="border-border shadow-[var(--shadow-card)]">
                <CardContent className="space-y-5 pt-6">
                  <Flex align="center" justify="between" wrap="wrap" gap="3">
                    <div>
                      <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        What happens next
                      </Text>
                      <Text as="p" size="2" className="mt-1 text-muted-foreground">
                        The platform routes candidates and admins automatically after OTP verification.
                      </Text>
                    </div>
                    <RadixButton asChild variant="soft" radius="full">
                      <Link href="/auth/register">Start now</Link>
                    </RadixButton>
                  </Flex>
                  <Grid columns={{ initial: "1", sm: "3" }} gap="3">
                    <div className="surface-panel-subtle px-4 py-3">
                      <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 1</Text>
                      <Text as="p" size="2" className="mt-1 text-foreground">
                        Create or open your account.
                      </Text>
                    </div>
                    <div className="surface-panel-subtle px-4 py-3">
                      <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 2</Text>
                      <Text as="p" size="2" className="mt-1 text-foreground">
                        Verify your OTP to activate secure access.
                      </Text>
                    </div>
                    <div className="surface-panel-subtle px-4 py-3">
                      <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 3</Text>
                      <Text as="p" size="2" className="mt-1 text-foreground">
                        Continue into the right workspace automatically.
                      </Text>
                    </div>
                  </Grid>
                </CardContent>
              </Card>
            </div>
          </Flex>
        </section>
      </div>
    </main>
  );
}
