/** @type {import('tailwindcss').Config} */
// Tokens mirror frontend/DESIGN.md. Components must read these — no ad-hoc hex.
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1B33",
          900: "#13294B",
          800: "#182F52",
          700: "#1E3A66",
        },
        brand: {
          400: "#3B82F6",
          500: "#2563EB",
          600: "#1D4ED8",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
        },
        teal: {
          400: "#2DD4BF",
          500: "#0D9488",
          600: "#0F766E",
        },
        rose: {
          500: "#E11D48",
          600: "#BE123C",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,27,51,0.04), 0 8px 24px rgba(11,27,51,0.08)",
        lift: "0 12px 32px rgba(11,27,51,0.14)",
      },
      keyframes: {
        "xp-fill": { from: { width: "0%" }, to: { width: "var(--xp)" } },
        "pop-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "xp-fill": "xp-fill 700ms ease-out forwards",
        "pop-in": "pop-in 220ms ease-out both",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
