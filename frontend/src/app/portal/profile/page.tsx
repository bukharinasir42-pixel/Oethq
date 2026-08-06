"use client";

/**
 * /portal/profile — the student's own details.
 *
 * Exists so profession is changeable at any time, not only when it happens to
 * be missing. Someone who picked the wrong one at sign-up, or a nurse who has
 * moved into midwifery, had no way to correct it: the field was write-once at
 * registration and admin-created accounts never had it at all.
 *
 * Name and email are read-only here. Changing an email is an identity change —
 * it is the login and the address every code goes to — so it stays with support
 * rather than becoming a one-click field.
 */
import { useCallback, useEffect, useState } from "react";
import { Mail, User } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfessionPicker } from "@/components/portal/profession-picker";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line, #E7EDF6)" }}>
      <span aria-hidden style={{ color: "var(--mute, #7A8CA3)", display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: "var(--mute, #7A8CA3)", minWidth: 96 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink, #0C1A2B)", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export default function PortalProfilePage() {
  const { profile, status, error, refresh, logout } = useSession();
  const [me, setMe] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await apiFetch<UserProfile>("/auth/me"));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void load();
  }, [load, profile]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading your profile…" layout="table" />;
  }
  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Sign in required"
        description={error || "Sign in to view your profile."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const profession = me?.profession ?? null;

  return (
    <PortalShell
      title="Your profile"
      description="Your details, and the profession your material is written for"
      profile={profile}
      onRefresh={() => void load()}
      onLogout={logout}
    >
      <div style={{ display: "grid", gap: 16, maxWidth: 620 }}>
        <section className="card card-pad">
          <Row icon={<User className="h-4 w-4" />} label="Name" value={profile.name} />
          <Row icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
          <p style={{ margin: "14px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--text, #54677E)" }}>
            To change your name or email, contact support — your email is how you sign in and where
            your codes are sent.
          </p>
        </section>

        <section className="card card-pad">
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>
            {profession ? "Your profession" : "Choose your profession"}
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text, #54677E)" }}>
            Your writing case notes and Speaking hack sentences are written per profession.
            {profession
              ? " It is set once so your material stays consistent — support can change it if you picked the wrong one."
              : " Choose carefully: this is set once."}
          </p>
          <ProfessionPicker current={profession} onSaved={() => void load()} />
        </section>
      </div>
    </PortalShell>
  );
}
