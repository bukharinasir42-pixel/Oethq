"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { humanizeError, isTechnicalError } from "@/lib/portal-utils";
import { cn } from "@/lib/utils";

type PortalErrorAlertProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
};

export function PortalErrorAlert({ title = "Something went wrong", description, onRetry }: PortalErrorAlertProps) {
  const [open, setOpen] = useState(false);
  const technical = isTechnicalError(description);
  const friendly = humanizeError(description);

  return (
    <Alert variant="destructive" className="p-4 sm:p-5">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{friendly}</p>
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onRetry}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Try again
            </Button>
          ) : null}
          {technical ? (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="cursor-pointer text-destructive">
                  Technical details
                  <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 max-h-32 overflow-auto rounded-md border border-destructive/20 bg-destructive/5 p-2 font-mono text-[11px] leading-relaxed">
                {description}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
