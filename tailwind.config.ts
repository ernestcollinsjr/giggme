import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "wiggle": {
          "0%, 100%": {
            transform: "rotate(-8deg)",
          },
          "50%": {
            transform: "rotate(8deg)",
          },
        },
        "slide-up-bounce": {
          "0%": {
            opacity: "0",
            transform: "translateY(60px) scale(0.9)",
          },
          "60%": {
            opacity: "1",
            transform: "translateY(-8px) scale(1.02)",
          },
          "80%": {
            transform: "translateY(4px) scale(0.98)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0) scale(1)",
          },
        },
        "slide-in-left": {
          "0%": {
            opacity: "0",
            transform: "translateX(-50px) scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0) scale(1)",
          },
        },
        "slide-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(50px) scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0) scale(1)",
          },
        },
        "pop-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.5)",
          },
          "70%": {
            transform: "scale(1.1)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "flash": {
          "0%": {
            opacity: "1",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "0",
            transform: "scale(0.8)",
          },
          "100%": {
            opacity: "0",
            transform: "scale(0.5) translateY(20px)",
          },
        },
        "pulse-ring": {
          "0%": {
            opacity: "0.4",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "0.1",
            transform: "scale(1.05)",
          },
          "100%": {
            opacity: "0.4",
            transform: "scale(1)",
          },
        },
        "bounce-subtle": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-4px)",
          },
        },
        "sparkle": {
          "0%, 100%": {
            opacity: "0",
            transform: "scale(0)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "wiggle": "wiggle 0.5s ease-in-out infinite",
        "slide-up-bounce": "slide-up-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-in-left": "slide-in-left 0.6s ease-out forwards",
        "slide-in-right": "slide-in-right 0.6s ease-out forwards",
        "pop-in": "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "flash": "flash 0.3s ease-out forwards",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "sparkle": "sparkle 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
