import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        ringBlue: {
          400: "#38bdf8",
          500: "#0284c7",
          600: "#0369a1",
        },
        assurance: {
          verified: "#10b981",
          interrupted: "#f59e0b",
          alert: "#ef4444",
          offline: "#64748b",
        },
        // Presentation site palette (/presentation): dark navy, warm white, restrained mint.
        ow: {
          ink: "#060B16",
          navy: "#0A1222",
          panel: "#0E1829",
          raised: "#13203A",
          line: "#1D2B45",
          paper: "#F4F0E6",
          muted: "#B6B2A6",
          subtle: "#8F8B81",
          mint: "#7FE3B8",
          "mint-strong": "#3ECF97",
          "mint-deep": "#0D3328",
          amber: "#F1B763",
          recheck: "#93B4FF",
          unknown: "#A9B1C3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
