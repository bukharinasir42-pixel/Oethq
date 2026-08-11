import type { Metadata } from "next";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";
import { COURSE_LANDING } from "@/lib/courses-catalogue";
import { SkillCourseLanding } from "../_components/skill-course-landing";
import { OethqExplanations } from "@/app/website/oethq-explanations";

const copy = COURSE_LANDING["reading"];

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/courses/reading" },
  openGraph: { title: copy.ogTitle, description: copy.ogDescription, url: "/courses/reading", type: "website" }
};

export default function ReadingCoursePage() {
  return (
    <OethqPageFrame>
      <SkillCourseLanding skill="reading" />
      {/* The walkthrough demonstration. It lives here rather than on the home
          page: someone reading this page has already decided the problem is
          Reading, which is exactly who the feature is for. */}
      <OethqExplanations />
    </OethqPageFrame>
  );
}
