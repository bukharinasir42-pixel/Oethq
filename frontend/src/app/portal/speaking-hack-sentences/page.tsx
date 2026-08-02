"use client";

/**
 * /portal/speaking-hack-sentences — the student's Speaking hack sentences.
 *
 * The sheets are per-profession: a nurse and a dietitian get different sentence
 * banks. The server picks the right one from the profession on the account, so
 * nothing here chooses — it just renders what came back, and says which bank it
 * is showing.
 *
 * Speaking ships with the Complete Material only, and the server returns
 * `locked` for anyone else rather than the PDF URLs, so nothing premium leaks
 * into the payload.
 */
import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, Lock, Mic } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";

type Sheet = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  pdfUrl: string | null;
};

type Payload = {
  locked: boolean;
  profession: string | null;
  usingGeneral: boolean;
  items: Sheet[];
};

export default function SpeakingHackSentencesPage() {
  const { profile, status, error, refresh, logout } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Sheet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await apiFetch<Payload>("/speaking-hack-sentences");
      setData(r);
      setActive(r.items[0] ?? null);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load your hack sentences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void load();
  }, [load, profile]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading hack sentences…" layout="table" />;
  }
  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Sign in required"
        description={error || "Sign in to open your Speaking hack sentences."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  return (
    <PortalShell
      title="Speaking Hack Sentences"
      description={
        data?.profession
          ? `Ready-made sentences for ${data.profession}${data.usingGeneral ? " — general bank" : ""}`
          : "Ready-made sentences for your role play"
      }
      profile={profile}
      onRefresh={() => void load()}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load" description={loadError} /> : null}

      {loading && !data ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data?.locked ? (
        <section className="mx-auto max-w-lg rounded-[18px] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-semibold text-[hsl(var(--primary-deep))]">
            Part of the OET Complete Material
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Speaking lectures and hack sentences come with the Complete Material, alongside all four skills.
          </p>
        </section>
      ) : (data?.items.length ?? 0) === 0 ? (
        <section className="mx-auto max-w-lg rounded-[18px] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary-deep))] text-white">
            <Mic className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-semibold text-[hsl(var(--primary-deep))]">Coming soon</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {data?.profession
              ? `Your ${data.profession} hack sentences are being written. They will appear here the moment they are published.`
              : "Hack sentences are being written and will appear here the moment they are published."}
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Sheet picker — a profession can have several sheets. */}
          <aside className="space-y-2">
            {data!.usingGeneral ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Showing the general bank. Sentences written specifically for
                {data!.profession ? ` ${data!.profession}` : " your profession"} will replace it once published.
              </p>
            ) : null}
            {data!.items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  active?.id === s.id
                    ? "border-[hsl(var(--primary-deep))] bg-[hsl(var(--primary-deep))]/5"
                    : "border-border bg-card hover:border-[hsl(var(--primary-deep))]/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[hsl(var(--primary-deep))]" />
                  <span className="min-w-0 text-sm font-medium text-foreground">{s.title}</span>
                </span>
                {s.description ? (
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{s.description}</span>
                ) : null}
              </button>
            ))}
          </aside>

          <section className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-semibold text-[hsl(var(--primary-deep))]">
                  {active?.title ?? "Hack sentences"}
                </h2>
                {data!.profession ? (
                  <p className="text-[11px] text-muted-foreground">{data!.profession}</p>
                ) : null}
              </div>
              {active?.pdfUrl ? (
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary-deep))] px-3 py-1.5 text-xs font-semibold text-white"
                  href={active.pdfUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
              ) : null}
            </div>
            {active?.pdfUrl ? (
              <object data={active.pdfUrl} type="application/pdf" className="h-[70vh] w-full">
                {/* iOS Safari will not render an inline PDF — give it a link. */}
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <p>Your browser cannot show this PDF inline.</p>
                  <a className="mt-2 inline-block font-semibold text-[hsl(var(--primary-deep))]" href={active.pdfUrl} target="_blank" rel="noreferrer">
                    Open it in a new tab
                  </a>
                </div>
              </object>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">This sheet has no file attached yet.</p>
            )}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
