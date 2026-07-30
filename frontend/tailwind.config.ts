import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" }
        },
        "oet-loader-bars": {
          "0%, 100%": { transform: "scaleY(0.4)", opacity: "0.45" },
          "50%": { transform: "scaleY(1)", opacity: "1" }
        },
        "oet-loader-orbit": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        },
        "oet-loader-shimmer": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        "oet-loader-fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "workspace-enter": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1s ease-in-out infinite",
        "oet-loader-bars": "oet-loader-bars 0.85s ease-in-out infinite",
        "oet-loader-orbit": "oet-loader-orbit 1.15s linear infinite",
        "oet-loader-shimmer": "oet-loader-shimmer 1.6s ease-in-out infinite",
        "oet-loader-fade-up": "oet-loader-fade-up 0.55s ease-out forwards",
        "workspace-enter": "workspace-enter 0.42s cubic-bezier(0.22, 1, 0.36, 1) both"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        premium: ["var(--font-premium)", "Georgia", "serif"],
        reading: ["var(--font-reading)", "Georgia", "serif"],
        "workspace-sans": ["var(--font-workspace-sans)", "var(--font-sans)", "system-ui", "sans-serif"],
        "workspace-display": ["var(--font-workspace-display)", "var(--font-display)", "system-ui", "sans-serif"],
        "portal-sans": ["var(--font-portal-sans)", "var(--font-sans)", "system-ui", "sans-serif"],
        "portal-display": ["var(--font-portal-display)", "var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        "blog-display": ["var(--font-blog-display)", "ui-serif", "Georgia", "serif"],
        "blog-serif": ["var(--font-blog-serif)", "Georgia", "serif"]
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
