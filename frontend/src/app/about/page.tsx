import type { Metadata } from "next";
import { OethqFounderTeam } from "@/app/website/oethq-founder-team";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";

export const metadata: Metadata = {
  title: "About Us | OET HQ",
  description:
    "A doctor who lived this exam, a data scientist who engineered the system, and a linguist who knows how English is really scored."
};

export default function AboutPage() {
  return (
    <OethqPageFrame>
      <OethqFounderTeam />
    </OethqPageFrame>
  );
}
