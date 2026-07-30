"use client";

/**
 * PremiumPortalShell — candidate-portal chrome (rail + topbar) matching the
 * oethq-candidate-portal design. Pure white/light-blue/navy. Driven by the same
 * `navigation` / `breadcrumbs` data the portal already builds, so gating,
 * locked-upgrade popups and active states are preserved. Scoped under
 * `.oethq-portal` (see premium-portal.css); the admin area keeps the old frame.
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock, LogOut, RefreshCw, type LucideIcon } from "lucide-react";
import type { UserProfile } from "@/lib/types";
import "./premium-portal.css";

type NavChild = { href: string; label: string; active: boolean };
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  locked?: boolean;
  onSelect?: () => void;
  children?: NavChild[];
};
type Crumb = { label: string; href?: string };

type Props = {
  profile: UserProfile;
  packageName?: string;
  breadcrumbs: Crumb[];
  countdownLabel?: string;
  navigation: NavItem[];
  onRefresh: () => void;
  onLogout: () => void;
  children: React.ReactNode;
};

const ClockIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export function PremiumPortalShell({
  profile,
  packageName,
  breadcrumbs,
  countdownLabel,
  navigation,
  onRefresh,
  onLogout,
  children
}: Props) {
  // Access meter for the rail foot. PREFER the passed countdownLabel — it carries
  // the student's TRUE remaining access (course entitlement OR subscription,
  // whichever is longer), so a course student whose free trial lapsed sees their
  // real window, not the expired 7-day trial. Fall back to the subscription only
  // when no effective countdown was supplied.
  const now = Date.now();
  const sub = profile.subscriptions.find((s) => s.status === "ACTIVE") ?? profile.subscriptions[0];
  let daysLeft: number | null = null;
  let percent: number | null = null;
  let expiry: string | null = null;
  const labelDays = countdownLabel?.match(/\d+/);
  if (labelDays) {
    daysLeft = Number(labelDays[0]);
    expiry = new Date(now + daysLeft * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } else if (sub?.endDate) {
    const end = new Date(sub.endDate).getTime();
    daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
    expiry = new Date(sub.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (sub.startDate) {
      const start = new Date(sub.startDate).getTime();
      const total = end - start;
      if (total > 0) percent = Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
    }
  }

  const avatarInitial = (profile.name?.trim()?.[0] ?? profile.email?.[0] ?? "U").toUpperCase();

  const crumbParts: Crumb[] = [
    ...(packageName ? [{ label: packageName }] : []),
    ...breadcrumbs.filter((b) => b.label !== packageName)
  ];

  // When a course sub-item is active, the top-level Dashboard default-active is
  // spurious — suppress flat "on" states in that case.
  const hasActiveChild = navigation.some((n) => n.children?.some((c) => c.active));
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  // Mobile / tablet: the rail is an off-canvas drawer.
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);
  const toggleGroup = (href: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });

  return (
    <div className="oethq-portal">
      <div className={`shell${navOpen ? " nav-open" : ""}`}>
        <div className="rail-backdrop" onClick={closeNav} aria-hidden />
        {/* ============ RAIL ============ */}
        <aside className="rail">
          <div className="rail-logo">
            <Link href="/portal" onClick={closeNav}><img src="/images/oethq/logo.png" alt="OET HQ" height={33} /></Link>
          </div>

          <div>
            <p className="rail-sec caps">Candidate portal</p>
            <nav className="nav">
              {navigation.map((item) => {
                const Icon = item.icon;
                // Expandable owned course group — open when it holds the active page.
                if (item.children) {
                  const open = openGroups.has(item.href) || item.children.some((c) => c.active);
                  return (
                    <details key={item.href} className="grp" open={open}>
                      <summary
                        onClick={(e) => { e.preventDefault(); toggleGroup(item.href); }}
                      >
                        <span className="nav">
                          <button type="button">
                            <Icon className="ic" aria-hidden />
                            {item.label}
                            <ChevronDown className="chev" aria-hidden />
                          </button>
                        </span>
                      </summary>
                      <div className="sub">
                        {item.children.map((c) => (
                          <Link key={c.href} href={c.href} className={c.active ? "on" : undefined} onClick={closeNav}>
                            <span className="dot" />
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    </details>
                  );
                }
                // Locked item (standalone-only cohort, or not-owned course group) → upgrade popup
                if (item.locked) {
                  return (
                    <button key={item.href} type="button" onClick={() => { closeNav(); item.onSelect?.(); }}>
                      <Icon className="ic" aria-hidden />
                      {item.label}
                      <Lock aria-hidden style={{ marginLeft: "auto", width: 14, height: 14, opacity: 0.5 }} />
                    </button>
                  );
                }
                // Normal link
                return (
                  <Link key={item.href} href={item.href} className={item.active && !hasActiveChild ? "on" : undefined} onClick={closeNav}>
                    <Icon className="ic" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {daysLeft != null && (
            <div className="rail-foot">
              <div className="row"><b className="num">{daysLeft}</b><span className="caps">days left</span></div>
              {percent != null && <div className="bar"><i style={{ width: `${percent}%` }} /></div>}
              {expiry && <p>Access ends {expiry}</p>}
            </div>
          )}
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          <div className="topbar">
            <div className="topbar-in">
              <button className="rail-toggle" type="button" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen((v) => !v)}>
                <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <p className="crumb">
                {crumbParts.map((c, i) => {
                  const last = i === crumbParts.length - 1;
                  return (
                    <span key={`${c.label}-${i}`}>
                      {i > 0 && <i>/</i>}
                      {last ? <b>{c.label}</b> : c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                    </span>
                  );
                })}
              </p>
              <div className="tb-right">
              {(daysLeft != null || countdownLabel) && (
                <span className="chip"><ClockIcon />{daysLeft != null ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : countdownLabel}</span>
              )}
              <button className="ghost" aria-label="Refresh" onClick={onRefresh}><RefreshCw aria-hidden /></button>
              <span className="avatar">{avatarInitial}</span>
              <button className="ghost" aria-label="Sign out" onClick={onLogout}><LogOut aria-hidden /></button>
              </div>
            </div>
          </div>

          <div className="page">{children}</div>
        </div>
      </div>
    </div>
  );
}
