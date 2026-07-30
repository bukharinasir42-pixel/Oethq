import type { PastPaperSummaryDto } from "@/lib/types";
import { parsePastPaperDayNumber, sortPastPapersByDay } from "@/lib/past-paper-utils";

export type PortalPastPaperSlot = {
  slotNumber: number;
  label: string;
  locked: boolean;
  configured: boolean;
  pastPaper: PastPaperSummaryDto | null;
};

/** Starter / free trial: past papers module is hidden entirely. */
export function hasPastPaperPortalAccess(planTier?: string | null, pastPaperLimit?: number | null) {
  if (!planTier || planTier === "STARTER") return false;
  return (pastPaperLimit ?? 0) > 0;
}

export function hasPastPaperConfigured(task: {
  pastPaper?: PastPaperSummaryDto | null;
  pastPaperTest?: { id: string } | null;
  pastPaperUrl?: string | null;
  pastPaperTitle?: string | null;
}) {
  return Boolean(
    task.pastPaper || task.pastPaperTest || task.pastPaperUrl?.trim() || task.pastPaperTitle?.trim()
  );
}

/**
 * Builds plan-scoped past paper slots (Past Paper 1 … N) where N = plan pastPaperLimit.
 * Slots within the plan limit are unlocked automatically; content comes from published admin bundles.
 */
export function buildPastPaperSlots(
  publishedPastPapers: PastPaperSummaryDto[],
  pastPaperLimit: number
): PortalPastPaperSlot[] {
  if (pastPaperLimit <= 0) return [];

  const paperBySlot = new Map<number, PastPaperSummaryDto>();
  for (const paper of sortPastPapersByDay(publishedPastPapers)) {
    const slotNumber = parsePastPaperDayNumber(paper.title);
    if (slotNumber !== Number.MAX_SAFE_INTEGER && slotNumber <= pastPaperLimit) {
      paperBySlot.set(slotNumber, paper);
    }
  }

  return Array.from({ length: pastPaperLimit }, (_, index) => {
    const slotNumber = index + 1;
    const pastPaper = paperBySlot.get(slotNumber) ?? null;

    return {
      slotNumber,
      label: `Past Paper ${slotNumber}`,
      locked: false,
      configured: Boolean(pastPaper),
      pastPaper
    };
  });
}
