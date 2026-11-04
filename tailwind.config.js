/**
 * Tailwind theme, moved verbatim from the inline `tailwind.config` that the
 * Play CDN carried in index.html. `fontFamily` points at the fontsource
 * variable families (Sora Variable / Inter Variable) with the old static
 * names kept as fallbacks.
 */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./scripts/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora Variable", "Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0b1220",
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#bed0ff",
          300: "#93b0ff",
          400: "#6086ff",
          500: "#3b5eff",
          600: "#2542e6",
          700: "#1e33b8",
          800: "#1e2f93",
          900: "#1e2c74",
          950: "#141c4a",
        },
        accent: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "pop-in": { "0%": { opacity: "0", transform: "scale(.94)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "slide-left": { "0%": { opacity: "0", transform: "translateX(24px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        "ring-pop": { "0%": { strokeDashoffset: "var(--ring-offset)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .45s cubic-bezier(.22,.61,.36,1) both",
        "fade-in": "fade-in .4s ease both",
        "pop-in": "pop-in .35s cubic-bezier(.22,.61,.36,1) both",
        "slide-left": "slide-left .4s cubic-bezier(.22,.61,.36,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.18)",
        lift: "0 2px 4px rgba(15,23,42,.05), 0 18px 40px -18px rgba(30,64,175,.35)",
      },
    },
  },
};
