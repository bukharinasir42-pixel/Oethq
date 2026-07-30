import type { Metadata } from "next";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";
import { COURSE_LANDING } from "@/lib/courses-catalogue";
import { SkillCourseLanding } from "../_components/skill-course-landing";

const copy = COURSE_LANDING["listening"];

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/courses/listening" },
  openGraph: { title: copy.ogTitle, description: copy.ogDescription, url: "/courses/listening", type: "website" }
};

export default function ListeningCoursePage() {
  return (
    <OethqPageFrame>
      <SkillCourseLanding skill="listening" />
    </OethqPageFrame>
  );
}
