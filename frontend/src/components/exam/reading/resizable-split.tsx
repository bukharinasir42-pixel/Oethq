"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type ResizableSplitProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  defaultLeftPercent?: number;
};

export function ResizableSplit({ left, right, className, defaultLeftPercent = 52 }: ResizableSplitProps) {
  return (
    <PanelGroup
      direction="horizontal"
      className={cn("h-full min-h-0 flex-1", className)}
      autoSaveId="oet-reading-split"
    >
      <Panel defaultSize={defaultLeftPercent} minSize={28} className="min-h-0">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{left}</div>
      </Panel>
      <PanelResizeHandle className="group relative flex w-2 shrink-0 items-center justify-center bg-border/40 transition-colors hover:bg-primary/20">
        <span
          className="absolute flex h-10 w-5 items-center justify-center rounded-md border border-border/70 bg-card shadow-sm"
          aria-hidden
        >
          <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </span>
      </PanelResizeHandle>
      <Panel
        defaultSize={100 - defaultLeftPercent}
        minSize={32}
        className="min-h-0 border-l border-border/50 bg-card"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{right}</div>
      </Panel>
    </PanelGroup>
  );
}
