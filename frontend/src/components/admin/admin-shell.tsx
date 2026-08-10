"use client";

import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  ClipboardCopy,
  CreditCard,
  FileText,
  Dumbbell,
  FileStack,
  GraduationCap,
  Headphones,
  SpellCheck,
  LayoutGrid,
  ListChecks,
  Newspaper,
  PenLine,
  ShieldAlert,
  Tag,
  UserSquare,
  Users,
  Video, MonitorSmartphone,
  MessageCircle,
  Radar
} from "lucide-react";
import { WorkspaceShellFrame } from "@/components/layout/workspace-shell-frame";
import type { UserProfile } from "@/lib/types";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/task-builder", label: "Task Builder", icon: ListChecks },
  { href: "/admin/how-to-videos", label: "How to Videos", icon: Video },
  { href: "/admin/course-lectures", label: "Course Lectures", icon: GraduationCap },
  { href: "/admin/skill-drills", label: "Skill Drills", icon: Dumbbell },
  { href: "/admin/reading-articles", label: "Reading Articles", icon: BookOpen },
  { href: "/admin/listening-podcasts", label: "Listening Podcasts", icon: Headphones },
  { href: "/admin/cheat-sheets", label: "Cheat Sheets", icon: FileStack },
  { href: "/admin/writing", label: "Writing Correction", icon: PenLine },
  { href: "/admin/spelling-bank", label: "Spelling Bank", icon: SpellCheck },
  { href: "/admin/past-paper", label: "Past Paper", icon: ClipboardCopy },
  { href: "/admin/test-builder", label: "Test Builder", icon: FileText },
  { href: "/admin/blogs", label: "Blogs", icon: Newspaper },
  { href: "/admin/pricing", label: "Price & Plan Management", icon: Tag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/subscribed-users", label: "Subscribed Users", icon: Users },
  { href: "/admin/accountability", label: "Accountability", icon: CalendarCheck },
  { href: "/admin/users", label: "All Users", icon: UserSquare },
  { href: "/admin/security", label: "Exam Security", icon: ShieldAlert },
  { href: "/admin/device-audit", label: "Device Audit", icon: MonitorSmartphone },
  { href: "/admin/progress", label: "Progress", icon: Activity },
  { href: "/admin/traffic", label: "Traffic", icon: Radar },
  { href: "/admin/assistant", label: "Assistant", icon: MessageCircle }
];

type AdminShellProps = {
  title: string;
  description: string;
  profile: UserProfile;
  stats?: Array<{ label: string; value: string | number }>;
  compact?: boolean;
  fillContent?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AdminShell({
  title,
  description,
  profile,
  stats = [],
  compact = false,
  fillContent = false,
  onRefresh,
  onLogout,
  children
}: AdminShellProps) {
  const pathname = usePathname();
  const navigation = links.map((link) => ({
    ...link,
    active: pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`))
  }));
  const activeLink = navigation.find((link) => link.active) || links[0];
  const breadcrumbs =
    activeLink.href === "/admin"
      ? [{ label: "Admin", href: "/admin" }, { label: "Overview" }]
      : [
          { label: "Admin", href: "/admin" },
          { label: activeLink.label }
        ];

  return (
    <WorkspaceShellFrame
      workspaceLabel="Admin workspace"
      title={title}
      description={description}
      profile={profile}
      badges={[]}
      navigation={navigation}
      breadcrumbs={breadcrumbs}
      stats={stats}
      compact={compact}
      fillContent={fillContent}
      onRefresh={onRefresh}
      onLogout={onLogout}
    >
      {children}
    </WorkspaceShellFrame>
  );
}
