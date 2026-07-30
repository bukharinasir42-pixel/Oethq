/**
 * Shared building blocks for the premium candidate-portal pages. All markup uses
 * the design-system classes scoped under `.oethq-portal` (see premium-portal.css).
 */
import type { ReactNode } from "react";

/** `.phead` — the standard page header (eyebrow + title + description). */
export function PortalPageHead({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="phead">
      <div>
        {eyebrow && <p className="caps">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
