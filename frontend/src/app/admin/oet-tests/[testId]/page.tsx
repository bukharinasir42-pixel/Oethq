"use client";

/**
 * /admin/oet-tests/[testId] — manage an imported (contentJson) OET test:
 * structure summary, publish toggle, replace-by-paste, preview as student.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ExternalLink, Headphones, Link2, Loader2, Music, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { OetImportDialog } from "@/components/admin/oet-import-dialog";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { oetTestsApi, type OetAdminDetail, type OetAudioState } from "@/lib/oet-tests-api";
import { collectQuestions } from "@/lib/oet-test-schema";

function summarize(d: OetAdminDetail) {
  const qs = collectQuestions(d.content);
  const byPart = { A: 0, B: 0, C: 0 };
  const readingA = d.type === "READING" ? 20 : 24;
  const readingB = d.type === "READING" ? 26 : 30;
  for (const q of qs) {
    if (q.n <= readingA) byPart.A++;
    else if (q.n <= readingB) byPart.B++;
    else byPart.C++;
  }
  return byPart;
}

export default function OetTestAdminPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const { profile, status, error, logout, refresh } = useSession();
  const [detail, setDetail] = useState<OetAdminDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await oetTestsApi.adminDetail(params.testId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load test");
    }
  }, [params.testId]);

  useEffect(() => {
    if (!profile || profile.role !== "ADMIN") return;
    void load();
  }, [load, profile]);

  const togglePublish = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await oetTestsApi.publish(detail.id, !detail.isPublished);
      toast.success(detail.isPublished ? "Unpublished" : "Published — now live for students who own this skill");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading test..." layout="editor" />;
  }
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return (
      <WorkspaceAccessDeniedState
        title="Admin access required"
        description={error || "Sign in with an admin account."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  const Icon = detail?.type === "LISTENING" ? Headphones : BookOpen;
  const parts = detail ? summarize(detail) : null;

  return (
    <AdminShell title="OET test" description="Manage an imported OET test." profile={profile} compact onRefresh={refresh} onLogout={logout}>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <button type="button" onClick={() => router.push("/admin/test-builder")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Test Builder
        </button>

        {loadError ? (
          <Card><CardContent className="py-8 text-sm text-destructive">{loadError}</CardContent></Card>
        ) : !detail ? (
          <WorkspaceLoadingState title="Loading test..." layout="editor" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                    <div>
                      <CardTitle className="text-lg">{detail.title}</CardTitle>
                      <CardDescription>
                        {detail.type === "READING" ? "Reading" : "Listening"} · {detail.totalQuestions} questions · imported
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={detail.isPublished ? "default" : "outline"}>{detail.isPublished ? "Published" : "Draft"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {parts && (
                  <div className="grid grid-cols-3 gap-3">
                    {(["A", "B", "C"] as const).map((p) => (
                      <div key={p} className="rounded-xl border border-border/70 bg-muted/20 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Part {p}</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{parts[p]}</p>
                        <p className="text-[11px] text-muted-foreground">questions</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Total {detail.timerDuration} min</Badge>
                  {detail.partATimer ? <Badge variant="outline">Part A {detail.partATimer} min</Badge> : null}
                  {detail.partBCTimer ? <Badge variant="outline">Parts B+C {detail.partBCTimer} min</Badge> : null}
                  <Badge variant="outline">Schema v{detail.contentSchemaVersion ?? 1}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
                <CardDescription>Publish to make it live (students who own this skill will see it). Replace re-imports from a fresh paste.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={togglePublish} disabled={busy} className="cursor-pointer">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {detail.isPublished ? "Unpublish" : "Publish"}
                </Button>
                <Button asChild variant="outline" className="cursor-pointer">
                  <Link href={`/portal/tests/${detail.id}`} target="_blank" rel="noopener">
                    Preview as student <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <OetImportDialog replaceTestId={detail.id} triggerLabel="Replace via paste" onImported={() => void load()} />
              </CardContent>
            </Card>

            {detail.type === "LISTENING" ? (
              <ListeningAudioCard testId={detail.id} initial={detail.audio} />
            ) : null}
          </>
        )}
      </div>
    </AdminShell>
  );
}

/** Attach the single session-audio to a listening test: upload a file OR paste a URL. */
function ListeningAudioCard({ testId, initial }: { testId: string; initial: OetAudioState | null }) {
  const [audio, setAudio] = useState<OetAudioState | null>(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "url" | "remove">(null);
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setBusy("upload");
    setPct(0);
    try {
      const asset = await oetTestsApi.uploadAudio(file, setPct);
      const next = await oetTestsApi.setAudio(testId, { audioAssetId: asset.id });
      setAudio(next);
      toast.success("Audio uploaded and attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSaveUrl = async () => {
    const v = url.trim();
    if (!v) return;
    setBusy("url");
    try {
      const next = await oetTestsApi.setAudio(testId, { audioUrl: v });
      setAudio(next);
      setUrl("");
      toast.success("Audio URL saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save URL");
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async () => {
    setBusy("remove");
    try {
      const next = await oetTestsApi.setAudio(testId, { audioAssetId: null, audioUrl: null });
      setAudio(next);
      toast.success("Audio removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove audio");
    } finally {
      setBusy(null);
    }
  };

  const hasAudio = !!audio?.url;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Music className="h-5 w-5" /></span>
          <div>
            <CardTitle className="text-base">Listening audio</CardTitle>
            <CardDescription>One session recording. Students play it once during the test.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAudio ? (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                {audio?.kind === "asset" ? <Upload className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {audio?.kind === "asset" ? "Uploaded file" : "Linked URL"}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void onRemove()} disabled={busy !== null} className="cursor-pointer text-destructive hover:text-destructive">
                {busy === "remove" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />} Remove
              </Button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audio?.url ?? undefined} controls className="w-full" />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
            No audio attached yet — this listening test won&apos;t play a recording until you add one.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upload a file</p>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => void onUpload(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="w-full cursor-pointer" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === "upload" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading {pct}%</> : <><Upload className="mr-2 h-4 w-4" /> Choose audio file</>}
            </Button>
            <p className="text-[11px] text-muted-foreground">mp3 / m4a / wav. Replaces any existing audio.</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Or paste a URL</p>
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/audio.mp3" disabled={busy !== null} />
              <Button type="button" onClick={() => void onSaveUrl()} disabled={busy !== null || !url.trim()} className="cursor-pointer">
                {busy === "url" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">e.g. a Bunny CDN link. Replaces any existing audio.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
