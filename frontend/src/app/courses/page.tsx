import type { Metadata } from "next";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";
import { CompleteCourseLanding } from "@/app/website/complete-course-landing";

export const metadata: Metadata = {
  title: "OET Complete Course — Choose Your Plan | OET HQ",
  description: "The OET Complete Course: four plans, one outcome — Grade B on your first attempt. Compare access, mock tests, OET HQ past papers, live drills and writing corrections."
};

export default function CoursesPage() {
  return (
    <OethqPageFrame>
      <CompleteCourseLanding />
    </OethqPageFrame>
  );
}
