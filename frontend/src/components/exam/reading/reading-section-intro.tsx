import type { ReadingSectionIntro } from "./reading-exam-instructions";

export function ReadingSectionIntroBlock({ title, body }: ReadingSectionIntro) {
  return (
    <div className="reading-section-intro mb-6 rounded-lg border border-border/60 bg-muted/15 px-4 py-4 sm:px-5">
      {title ? <p className="mb-2 text-base font-semibold text-foreground">{title}</p> : null}
      <p className="text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}
