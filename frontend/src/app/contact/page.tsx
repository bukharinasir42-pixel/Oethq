import type { Metadata } from "next";
import { OethqContact } from "@/app/website/oethq-contact";
import { OethqPageFrame } from "@/app/website/oethq-page-frame";

export const metadata: Metadata = {
  title: "Contact Us | OET HQ",
  description:
    "Reach OET HQ by phone, email, or WhatsApp for course guidance, enrollment help, and plan support."
};

export default function ContactPage() {
  return (
    <OethqPageFrame>
      <OethqContact />
    </OethqPageFrame>
  );
}
