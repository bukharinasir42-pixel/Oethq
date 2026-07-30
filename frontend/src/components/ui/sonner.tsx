"use client"

import * as React from "react"
import {
  CircleCheck,
  Info,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { InlineLoader } from "@/components/loaders"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Sonner
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <InlineLoader label="Loading" className="text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border border-border shadow-xl",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
