import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
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
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom pastel colors for HR system
        pastel: {
          blue: "#E6F3FF",
          green: "#E8F5E8",
          purple: "#F0E6FF",
          pink: "#FFE6F0",
          yellow: "#FFF9E6",
          orange: "#FFE6D9",
          red: "#FFE6E6",
          teal: "#E6FFFA",
        },
        // Status colors with pastel variants
        status: {
          success: "#10B981",
          "success-light": "#D1FAE5",
          warning: "#F59E0B",
          "warning-light": "#FEF3C7",
          error: "#EF4444",
          "error-light": "#FEE2E2",
          info: "#3B82F6",
          "info-light": "#DBEAFE",
        },
        // HR specific colors
        hr: {
          attendance: "#10B981",
          "attendance-light": "#D1FAE5",
          leave: "#F59E0B",
          "leave-light": "#FEF3C7",
          payroll: "#8B5CF6",
          "payroll-light": "#EDE9FE",
          expense: "#06B6D4",
          "expense-light": "#CFFAFE",
          performance: "#EC4899",
          "performance-light": "#FCE7F3",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      boxShadow: {
        "soft": "0 2px 8px 0 rgba(0, 0, 0, 0.05)",
        "medium": "0 4px 16px 0 rgba(0, 0, 0, 0.08)",
        "strong": "0 8px 32px 0 rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config

export default config