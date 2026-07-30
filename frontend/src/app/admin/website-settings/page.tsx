import { redirect } from "next/navigation";

export default function WebsiteSettingsRedirectPage() {
  redirect("/admin/how-to-videos#homepage-video");
}
