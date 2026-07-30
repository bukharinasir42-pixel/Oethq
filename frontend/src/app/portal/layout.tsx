import { Suspense } from "react";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { cn } from "@/lib/utils";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("font-portal-sans", "portal-surface min-h-full")}>
      <Suspense fallback={<WorkspaceLoadingState title="Loading portal..." layout="editor" />}>{children}</Suspense>
    </div>
  );
}
