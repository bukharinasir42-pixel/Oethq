import type { Metadata } from "next";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";
import { OethqStoriesSlider } from "@/app/website/oethq-stories-slider";

export const metadata: Metadata = {
  title: "Success Stories | OET HQ",
  description: "Real students. Real messages. See how candidates cleared OET with OET HQ."
};

export default function StoriesPage() {
  return (
    <OethqPageFrame>
      <OethqStoriesSlider />
    </OethqPageFrame>
  );
}
