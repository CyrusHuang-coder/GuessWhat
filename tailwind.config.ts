import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: "#F7F6F0",
          card: "#FFFFFF",
          border: "#E4DFD7",
          subtle: "#EFECE4",
        },
        sage: {
          50: "#F4F7F3",
          100: "#E5EDE4",
          200: "#CCDDCB",
          300: "#ABC5AA",
          500: "#5F7C69",
          600: "#4F6857",
          700: "#3E5345",
          800: "#2F3F34",
          900: "#222D25",
        },
        terracotta: {
          50: "#FAF6F3",
          100: "#F0E7DF",
          200: "#E2CFBF",
          500: "#C47858",
          600: "#B06545",
          700: "#8C4D33",
        },
        ink: {
          text: "#2C3E35",
          muted: "#63756A",
          subtle: "#91A096",
        },
        status: {
          warn: "#B46B28",
          warnBg: "#FAF1E4",
          warnBorder: "#EED9B9",
          err: "#A84442",
          errBg: "#FBF0EE",
          errBorder: "#F0CFCB",
          ok: "#427354",
          okBg: "#EBF4EE",
          okBorder: "#C6E2CF",
        },
      },
      borderRadius: {
        'game-sm': '12px',
        'game': '16px',
        'game-lg': '20px',
      },
      boxShadow: {
        'board': '0 2px 8px -2px rgba(44, 62, 53, 0.05), 0 1px 3px 0 rgba(44, 62, 53, 0.03)',
        'board-hover': '0 8px 24px -4px rgba(44, 62, 53, 0.08), 0 2px 6px 0 rgba(44, 62, 53, 0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
