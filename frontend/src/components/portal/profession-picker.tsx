"use client";

/**
 * ProfessionPicker — lets a student set or change their own profession.
 *
 * It exists because a candidate created from the admin panel has none: that form
 * never collected one. Those students opened Writing Corrections and were told
 * "Your account has no profession on file… please contact support" — a dead end
 * for a question only they can answer.
 *
 * The value is not cosmetic. It selects which writing case-note library and
 * which Speaking hack-sentence PDF they are served, which is why the copy says
 * so plainly rather than presenting it as a profile detail.
 *
 * Two shapes:
 *   variant="prompt" — a full card, for when the profession is missing and the
 *                      page cannot work without it.
 *   variant="inline" — a compact row, for changing one already set.
 */
import { useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PROFESSIONS } from "@/lib/profile-options";

type Props = {
  current?: string | null;
  variant?: "prompt" | "inline";
  /** Called after a successful save so the page can reload its content. */
  onSaved?: (profession: string) => void;
};

export function ProfessionPicker({ current, variant = "prompt", onSaved }: Props) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value || value === current) return;
    setSaving(true);
    try {
      await apiFetch("/auth/me/profession", { method: "PATCH", body: { profession: value } });
      toast.success(`Profession set to ${value}`);
      onSaved?.(value);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save your profession");
    } finally {
      setSaving(false);
    }
  };

  const select = (
    <select
      aria-label="Profession"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{
        flex: 1, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10,
        border: "1px solid var(--line, #D9E2EF)", background: "#fff",
        font: "500 14px/1 system-ui, sans-serif", color: "var(--ink, #0C1A2B)"
      }}
    >
      <option value="" disabled>Choose your profession…</option>
      {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  );

  const button = (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!value || value === current || saving}
      className="btn btn-primary btn-sm"
      style={{ minWidth: 96, opacity: !value || value === current ? 0.55 : 1 }}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : current ? "Update" : "Save"}
    </button>
  );

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {select}
        {button}
      </div>
    );
  }

  return (
    <section className="card card-pad" style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex", width: 44, height: 44, borderRadius: 12, marginBottom: 12,
          alignItems: "center", justifyContent: "center",
          background: "var(--sky, #EAF3FC)", color: "var(--brand, #0B63B0)"
        }}
      >
        <Stethoscope className="h-5 w-5" />
      </span>
      <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Which profession are you sitting OET for?</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text, #54677E)" }}>
        Your case notes and Speaking hack sentences are written for your profession, so we need this
        before we can show you the right ones. You can change it later.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {select}
        {button}
      </div>
    </section>
  );
}
