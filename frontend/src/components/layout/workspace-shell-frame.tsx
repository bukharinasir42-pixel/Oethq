"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Heading, Text } from "@radix-ui/themes";
import { ChevronDown, Clock3, Lock, LogOut, Menu, RefreshCw, type LucideIcon } from "lucide-react";
import { OetBrandLogo } from "@/components/brand/oet-brand-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavigationChild = {
  href: string;
  label: string;
  icon?: LucideIcon;
  active?: boolean;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  tooltip?: string;
  /** Render as a locked upsell: shows a lock, and clicking calls onSelect instead of navigating. */
  locked?: boolean;
  onSelect?: () => void;
  /** Expandable course group: hover (desktop) / tap (mobile) reveals these sub-items. */
  children?: NavigationChild[];
};

type BreadcrumbEntry = {
  label: string;
  href?: string;
};

type WorkspaceShellFrameProps = {
  workspaceLabel: string;
  title: string;
  description: string;
  profile: UserProfile;
  navigation: NavigationItem[];
  breadcrumbs: BreadcrumbEntry[];
  badges?: string[];
  packageName?: string;
  examCountdownLabel?: string;
  upgradeHref?: string;
  onUpgradeClick?: () => void;
  stats?: Array<{ label: string; value: string | number }>;
  compact?: boolean;
  fillContent?: boolean;
  hidePageHeader?: boolean;
  slimPageHeader?: boolean;
  hideSidebar?: boolean;
  hideWorkspaceHeader?: boolean;
  sidebarExtra?: React.ReactNode;
  usePortalChrome?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  children: React.ReactNode;
};

function getInitials(profile: UserProfile) {
  const source = profile.name?.trim() || profile.email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function MetaRow({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}

/** An owned course: header expands on hover (desktop) / tap to reveal sub-items. */
function NavGroup({ item, onNavigate }: { item: NavigationItem; onNavigate?: () => void }) {
  const childActive = item.children?.some((ch) => ch.active) ?? false;
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  return (
    <div
      className="group/nav"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(childActive)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-[11px] px-3.5 py-2.5 text-left text-sm font-medium transition-colors duration-150",
          childActive ? "text-primary" : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", childActive ? "text-primary" : "text-primary/70")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" aria-hidden title="Owned" />
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-3">
            {item.children?.map((ch) => {
              const ChildIcon = ch.icon;
              return (
                <Link
                  key={ch.href}
                  href={ch.href}
                  onClick={onNavigate}
                  aria-current={ch.active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    ch.active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground"
                  )}
                >
                  {ChildIcon ? <ChildIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  <span className="truncate">{ch.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSidebarNav({
  workspaceLabel,
  profile,
  navigation,
  sidebarExtra,
  packageName,
  onNavigate
}: {
  workspaceLabel: string;
  profile: UserProfile;
  navigation: NavigationItem[];
  sidebarExtra?: React.ReactNode;
  packageName?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
      <div className="shrink-0 px-4 pb-1 pt-5">
        <div className="px-1">
          <OetBrandLogo className="w-[130px]" />
          <p className="mt-2 text-[9.5px] font-medium uppercase tracking-[0.24em] text-[hsl(210_25%_64%)]">
            {workspaceLabel}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-[16px] border border-border bg-muted px-3.5 py-3.5">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="oet-logo-mark font-display text-[13px] font-semibold text-white shadow-none">
              {getInitials(profile)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-foreground">{profile.name || "Member"}</p>
            {profile.email ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={profile.email}>
                {profile.email}
              </p>
            ) : null}
            {packageName ? (
              <span
                className="mt-1.5 flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-primary"
                title={packageName}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--success))]" aria-hidden />
                <span className="min-w-0 truncate">{packageName}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="px-5 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[hsl(210_25%_64%)]">
        Navigate
      </p>
      <nav
        className="thin-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 pb-4"
        aria-label="Workspace navigation"
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const itemClass = cn(
            "group relative flex w-full items-center gap-3 rounded-[11px] px-3.5 py-2.5 text-left text-sm font-medium transition-colors duration-150",
            item.active
              ? "bg-primary/10 text-primary"
              : item.locked
                ? "text-muted-foreground/70 hover:bg-primary/[0.06] hover:text-foreground"
                : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground"
          );
          const inner = (
            <>
              {item.active ? (
                <span
                  className="absolute -left-3 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[image:var(--grad)]"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-[19px] w-[19px] shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
              {item.locked ? (
                <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(210_25%_64%)]" aria-hidden />
              ) : item.tooltip ? (
                <span className="ml-auto shrink-0 text-[9px] uppercase tracking-[0.14em] text-[hsl(210_25%_64%)]">
                  {item.tooltip}
                </span>
              ) : null}
            </>
          );
          if (item.children && item.children.length > 0 && !item.locked) {
            return <NavGroup key={item.href} item={item} onNavigate={onNavigate} />;
          }
          if (item.locked) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  item.onSelect?.();
                  onNavigate?.();
                }}
                aria-haspopup="dialog"
                className={cn(itemClass, "cursor-pointer")}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={item.active ? "page" : undefined}
              className={itemClass}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {sidebarExtra ? <div className="mt-auto shrink-0 px-3 pb-4 pt-1">{sidebarExtra}</div> : null}
    </div>
  );
}

export function WorkspaceShellFrame({
  workspaceLabel,
  title,
  description,
  profile,
  navigation,
  breadcrumbs,
  badges = [],
  packageName,
  examCountdownLabel,
  upgradeHref,
  onUpgradeClick,
  stats = [],
  compact = false,
  fillContent = false,
  hidePageHeader = false,
  slimPageHeader = false,
  hideSidebar = false,
  hideWorkspaceHeader = false,
  sidebarExtra,
  usePortalChrome = false,
  onRefresh,
  onLogout,
  children
}: WorkspaceShellFrameProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const statColumnsClass =
    stats.length >= 4 ? "xl:grid-cols-4" : stats.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2";

  return (
    <div
      className={cn(
        "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground",
        hideSidebar ? "lg:grid lg:grid-cols-1" : "lg:grid lg:grid-cols-[260px_minmax(0,1fr)]",
        usePortalChrome ? "font-portal-sans" : "font-workspace-sans"
      )}
    >
      <aside
        className={cn(
          "hidden min-h-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh",
          hideSidebar && "lg:hidden"
        )}
      >
        <WorkspaceSidebarNav
          workspaceLabel={workspaceLabel}
          profile={profile}
          navigation={navigation}
          sidebarExtra={sidebarExtra}
          packageName={packageName}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!hideWorkspaceHeader ? (
        <header className="workspace-chrome-header z-20 shrink-0">
          <div className="relative flex w-full flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6 lg:px-9">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-[10px] border-border bg-card shadow-[var(--shadow-card)] lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="workspace-mobile-nav"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-tight text-muted-foreground">
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <Fragment key={`${item.label}-${index}`}>
                      {item.href && !isLast ? (
                        <Link
                          href={item.href}
                          className="rounded-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            isLast
                              ? cn(
                                  "font-semibold text-foreground",
                                  usePortalChrome ? "font-portal-display" : "font-workspace-display"
                                )
                              : "text-muted-foreground"
                          )}
                        >
                          {item.label}
                        </span>
                      )}
                      {!isLast ? (
                        <span className="select-none text-muted-foreground/50" aria-hidden>
                          /
                        </span>
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              {onUpgradeClick ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-full px-4 text-[12.5px] font-semibold shadow-[var(--shadow-card)]"
                  onClick={onUpgradeClick}
                >
                  Upgrade
                </Button>
              ) : upgradeHref ? (
                <Button
                  asChild
                  size="sm"
                  className="h-9 rounded-full px-4 text-[12.5px] font-semibold shadow-[var(--shadow-card)]"
                >
                  <Link href={upgradeHref}>Upgrade</Link>
                </Button>
              ) : null}

              {examCountdownLabel ? (
                <Badge
                  variant="outline"
                  className="hidden max-w-[14rem] items-center gap-1.5 truncate rounded-full border-orange-200 bg-orange-50 px-3.5 py-1.5 text-[12.5px] font-medium normal-case tracking-normal text-orange-700 shadow-[var(--shadow-card)] sm:inline-flex dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200"
                  title={examCountdownLabel}
                >
                  <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{examCountdownLabel}</span>
                </Badge>
              ) : packageName ? (
                <Badge
                  variant="outline"
                  className="hidden max-w-[11rem] truncate rounded-full border-border bg-card px-3.5 py-1.5 text-[12.5px] font-medium normal-case tracking-normal text-muted-foreground shadow-[var(--shadow-card)] sm:inline-flex"
                  title={packageName}
                >
                  {packageName}
                </Badge>
              ) : null}

              <ThemeToggle className="h-9 w-9 rounded-[10px] border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:border-[hsl(210_48%_83%)] hover:text-primary" />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-[10px] border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:border-[hsl(210_48%_83%)] hover:text-primary"
                onClick={onRefresh}
                aria-label="Refresh data"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-[10px] border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:border-destructive/40 hover:text-destructive"
                onClick={onLogout}
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </header>
        ) : null}

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            id="workspace-mobile-nav"
            side="left"
            className={cn(
              "flex w-[min(19rem,calc(100vw-1rem))] max-w-[92vw] flex-col gap-0 border-border bg-card p-0",
              "[&>button]:right-3 [&>button]:top-3 [&>button]:z-50 [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-card [&>button]:shadow-md"
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col pt-2">
              <WorkspaceSidebarNav
                workspaceLabel={workspaceLabel}
                profile={profile}
                navigation={navigation}
                sidebarExtra={sidebarExtra}
                packageName={packageName}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <main
          className={cn(
            "thin-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain",
            fillContent && "flex flex-col"
          )}
        >
          <div
            className={cn(
              compact ? "space-y-5" : "space-y-6",
              "w-full",
              hideWorkspaceHeader
                ? "flex min-h-0 flex-1 flex-col p-0"
                : "px-4 py-6 sm:px-5 sm:py-7 lg:px-6 lg:pb-16 xl:px-8",
              fillContent && !hideWorkspaceHeader && "flex min-h-0 flex-1 flex-col"
            )}
          >
            {!hidePageHeader && slimPageHeader ? (
              <div className={cn("portal-slim-header shrink-0", fillContent && "shrink-0")}>
                <div className="space-y-2">
                  <MetaRow items={badges} />
                  <h1>{title}</h1>
                  <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ) : null}
            {!hidePageHeader && !slimPageHeader ? (
              <Card className={cn("border-border shadow-[var(--shadow-card)]", fillContent && "shrink-0")}>
                <CardHeader className="space-y-4 p-6 pb-5 sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{workspaceLabel}</p>
                  <MetaRow items={badges} />
                  <div className="space-y-1.5">
                    <Heading
                      size={compact ? "6" : "7"}
                      className={cn(
                        "text-balance tracking-tight text-[hsl(var(--primary-deep))]",
                        usePortalChrome ? "font-portal-display" : "font-workspace-display"
                      )}
                    >
                      {title}
                    </Heading>
                    <Text size={compact ? "2" : "3"} className="max-w-5xl text-muted-foreground">
                      {description}
                    </Text>
                  </div>
                </CardHeader>
              </Card>
            ) : null}

            {stats.length > 0 ? (
              <section className={cn("grid gap-4 sm:gap-5 md:grid-cols-2", statColumnsClass)}>
                {stats.map((stat) => (
                  <Card key={stat.label} className="shadow-[var(--shadow-card)]">
                    <CardContent className="py-5">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 font-display text-2xl font-semibold text-[hsl(var(--primary-deep))]">
                        {stat.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : null}

            <div className={cn("min-w-0", fillContent ? "flex min-h-0 flex-1 flex-col" : "")}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
