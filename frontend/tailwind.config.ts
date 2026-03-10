import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KCC Brand — Arkham Intelligence inspired dark theme
        background: {
          DEFAULT: "#0a0a0f",
          secondary: "#0f0f1a",
          tertiary: "#141420",
          card: "#12121e",
          hover: "#1a1a2a",
        },
        border: {
          DEFAULT: "#1e1e30",
          subtle: "#161625",
          accent: "#252540",
        },
        primary: {
          DEFAULT: "#6366f1", // indigo
          dark: "#4f46e5",
          light: "#818cf8",
          muted: "#3730a3",
        },
        accent: {
          cyan: "#06b6d4",
          violet: "#8b5cf6",
          amber: "#f59e0b",
        },
        risk: {
          low: "#22c55e",
          medium: "#f59e0b",
          high: "#ef4444",
          critical: "#dc2626",
          unknown: "#6b7280",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#475569",
          accent: "#818cf8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-dark":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        "glow-indigo":
          "radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(99,102,241,0.2)",
        "glow-md": "0 0 30px rgba(99,102,241,0.25)",
        "glow-lg": "0 0 60px rgba(99,102,241,0.3)",
        "card": "0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "scan": "scan 2s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(99,102,241,0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(99,102,241,0.5)" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
