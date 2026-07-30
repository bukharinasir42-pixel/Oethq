import type { Metadata } from "next";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";
import { WritingCorrectionsLanding } from "./writing-corrections-landing";

export const metadata: Metadata = {
  title: "OET Writing Corrections — Marked to Official Criteria | OET HQ",
  description: "Get your OET letters marked against all six official OET Writing criteria. Buy 2, 6 or 12 corrections — clear our correction, clear the exam.",
  alternates: { canonical: "/courses/writing-corrections" },
  openGraph: { title: "OET Writing Corrections", description: "Letters marked to the official OET Writing criteria — 2, 6 or 12 packs.", url: "/courses/writing-corrections", type: "website" }
};

export default function WritingCorrectionsCoursePage() {
  return (
    <OethqPageFrame>
      <WritingCorrectionsLanding />
    </OethqPageFrame>
  );
}
