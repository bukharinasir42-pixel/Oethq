"use client";

import * as React from "react";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

function RadixThemeBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const appearance = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Theme
      appearance={appearance}
      accentColor="blue"
      grayColor="slate"
      radius="large"
      scaling="100%"
      panelBackground="solid"
    >
      {children}
    </Theme>
  );
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <RadixThemeBridge>
        {children}
      </RadixThemeBridge>
    </NextThemesProvider>
  );
}
