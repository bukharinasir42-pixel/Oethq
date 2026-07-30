"use client";

/**
 * /admin/spelling-bank — manage the OET Listening spelling bank. Search/filter,
 * edit difficulty/active, delete, and bulk-import terms from CSV or JSON. The
 * Listening Spellings assessment always runs the live bank.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SpellCheck, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { spellingApi, type AdminSpellingTerm, type SpellingCounts } from "@/lib/spelling-api";

const PAGE_SIZE = 50;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

type NewTerm = { term: string; category: string; hint?: string; difficulty?: number; words?: number };

function parseUpload(text: string, filename: string): NewTerm[] {
  const t = text.trim();
  if (/\.json$/i.test(filename) || t.startsWith("{") || t.startsWith("[")) {
    const j = JSON.parse(t);
    const arr: Record<string, unknown>[] = Array.isArray(j) ? j : (Array.isArray(j.items) ? j.items : []);
    return arr.map((x) => ({
      term: String(x.term ?? ""), category: String(x.category ?? ""),
      hint: x.hint != null ? String(x.hint) : "", difficulty: Number(x.difficulty) || 1, words: Number(x.words) || undefined
    }));
  }
  // CSV
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iTerm = header.indexOf("term"), iCat = header.indexOf("category"), iHint = header.indexOf("hint"),
    iDiff = header.indexOf("difficulty"), iWords = header.indexOf("words");
  if (iTerm < 0 || iCat < 0) throw new Error("CSV needs 'term' and 'category' columns");
  return lines.slice(1).map((l) => {
    const c = parseCsvLine(l);
    return {
      term: c[iTerm] ?? "", category: c[iCat] ?? "", hint: iHint >= 0 ? (c[iHint] ?? "") : "",
      difficulty: iDiff >= 0 ? Number(c[iDiff]) || 1 : 1, words: iWords >= 0 ? Number(c[iWords]) || undefined : undefined
    };
  });
}

export default function AdminSpellingBankPage() {
  const { profile, status, error, logout, refresh } = useSession();
  const [counts, setCounts] = useState<SpellingCounts | null>(null);
  const [rows, setRows] = useState<AdminSpellingTerm[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (opts: { page: number; search: string; category: string }) => {
    setLoading(true);
    try {
      const [list, cnt] = await Promise.all([
        spellingApi.adminList({ page: opts.page, pageSize: PAGE_SIZE, search: opts.search || undefined, category: opts.category || undefined }),
        spellingApi.adminCounts()
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setCounts(cnt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "ADMIN") void load({ page, search, category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, page, category]);

  const runSearch = () => { setPage(1); void load({ page: 1, search, category }); };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const file = Array.from(fileList)[0];
    if (!file) return;
    setUploading(true);
    try {
      const parsed = parseUpload(await file.text(), file.name).filter((t) => t.term && t.category);
      if (!parsed.length) { toast.error("No valid rows found (need term + category)."); return; }
      const res = await spellingApi.adminCreate(parsed);
      toast.success(`${res.created} term${res.created === 1 ? "" : "s"} imported`);
      await load({ page, search, category });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (t: AdminSpellingTerm) => {
    setBusyId(t.id);
    try { await spellingApi.adminUpdate(t.id, { isActive: !t.isActive }); await load({ page, search, category }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusyId(null); }
  };
  const setDifficulty = async (t: AdminSpellingTerm, d: number) => {
    setBusyId(t.id);
    try { await spellingApi.adminUpdate(t.id, { difficulty: d }); await load({ page, search, category }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusyId(null); }
  };
  const remove = async (t: AdminSpellingTerm) => {
    if (!window.confirm(`Delete "${t.term}"?`)) return;
    setBusyId(t.id);
    try { await spellingApi.adminDelete(t.id); toast.success("Deleted"); await load({ page, search, category }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusyId(null); }
  };

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading..." layout="editor" />;
  if (status === "unauth" || profile?.role !== "ADMIN") {
    return <WorkspaceAccessDeniedState title="Admin access required" description={error || "Sign in with an admin account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categories = counts ? Object.keys(counts.byCategory).sort() : [];

  return (
    <AdminShell title="Spelling Bank" description="OET Listening Part A spelling terms — the live bank behind the Listening Spellings assessment." profile={profile} onRefresh={() => load({ page, search, category })} onLogout={logout}>
      {/* Overview */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant="outline" className="tabular-nums">{counts?.total ?? "…"} total</Badge>
        <Badge variant="outline" className="tabular-nums border-emerald-300 text-emerald-600">{counts?.active ?? "…"} active</Badge>
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => { setCategory(category === c ? "" : c); setPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${category === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
            {c}<span className="rounded bg-muted px-1 text-[10px] tabular-nums">{counts?.byCategory[c]}</span>
          </button>
        ))}
      </div>

      {/* Import */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Bulk import</CardTitle>
          <CardDescription>Drop a <code>.csv</code> (columns: term, category, hint, difficulty, words) or <code>.json</code> (array or <code>{`{ items: [...] }`}</code>). New terms are added to the bank.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); void uploadFiles(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"}`}>
            {uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <UploadCloud className="h-7 w-7 text-muted-foreground" />}
            <p className="text-sm font-semibold text-foreground">{uploading ? "Importing…" : "Drop CSV / JSON here"}</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
            onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-lg"><SpellCheck className="h-5 w-5 text-primary" /> Terms {category ? `· ${category}` : ""}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Search terms…" className="max-w-xs" />
            <Button type="button" size="sm" variant="outline" onClick={runSearch}>Search</Button>
            {(search || category) && <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(""); setCategory(""); setPage(1); void load({ page: 1, search: "", category: "" }); }}>Clear</Button>}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{total.toLocaleString()} results</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <WorkspaceLoadingState title="Loading terms..." layout="table" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No terms match.</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{t.term}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{t.category} · {t.hint || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1" title="Difficulty">
                    {[1, 2, 3].map((d) => (
                      <button key={d} type="button" disabled={busyId === t.id} onClick={() => void setDifficulty(t, d)}
                        className={`h-6 w-6 rounded text-[11px] font-bold tabular-nums transition ${t.difficulty === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{d}</button>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={busyId === t.id} onClick={() => void toggleActive(t)} className="w-24 cursor-pointer">
                    {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t.isActive ? "Active" : "Inactive"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busyId === t.id} onClick={() => void remove(t)} className="cursor-pointer text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="text-xs text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
              <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
