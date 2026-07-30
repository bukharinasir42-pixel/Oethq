export const metadata = {
  title: "Admin · OET LMS",
  description: "Admin portal for plans, users, and content."
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background font-workspace-sans text-foreground">{children}</div>;
}
