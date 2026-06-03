/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep, layered dark surfaces (app background -> raised cards).
        ink: {
          950: "#070b14",
          900: "#0b1120",
          800: "#0f1629",
          700: "#141d33",
          600: "#1b2740",
        },
        line: "#1e293b",
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        accent: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        up: "#22c55e",
        down: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(16,185,129,0.25), 0 10px 40px -10px rgba(16,185,129,0.25)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
        "grid-faint":
          "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.06) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
