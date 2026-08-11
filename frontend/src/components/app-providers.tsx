"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { AttributionTracker } from "@/components/attribution-tracker";
import { ChatWidget } from "@/components/chat/chat-widget";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        {children}
        {/* Both mount once, at the root, so they cover the marketing site and
            the portal together. Each decides for itself where it must not
            appear — the assistant hides on exam and admin routes. */}
        <AttributionTracker />
        <ChatWidget />
      </SessionProvider>
    </ThemeProvider>
  );
}
