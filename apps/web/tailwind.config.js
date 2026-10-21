/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Plus Jakarta Sans", "sans-serif"],
      mono: ["Geist Mono Variable", "monospace"],
    },
    fontSize: {
      xs: ["12px", { lineHeight: "1.5" }],
      sm: ["13px", { lineHeight: "1.5" }],
      base: ["14px", { lineHeight: "1.5" }],
      md: ["16px", { lineHeight: "1.25" }],
      lg: ["20px", { lineHeight: "1.25" }],
      xl: ["24px", { lineHeight: "1.25" }],
      hero: ["48px", { lineHeight: "1.1" }],
    },
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        muted: "var(--muted)",
        subtle: "var(--subtle)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        link: "var(--link)",
        // Texte posé sur le fond de marque des écrans de compte, toujours
        // sombre quel que soit le thème (voir docs/adr/0019).
        "auth-text": "var(--auth-text)",
        "auth-text-muted": "var(--auth-text-muted)",
        "accent-soft": "var(--accent-soft)",
        "accent-soft-2": "var(--accent-soft-2)",
        "assistant-bg": "var(--assistant-bg)",
        "assistant-border": "var(--assistant-border)",
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
      },
      borderRadius: {
        control: "6px",
        card: "8px",
        panel: "12px",
      },
      spacing: {
        4.5: "18px",
      },
      height: {
        control: "36px",
        "control-compact": "32px",
        "control-mobile": "44px",
      },
      width: {
        rail: "64px",
        "channel-list": "240px",
        panel: "300px",
      },
      size: {
        control: "36px",
        "control-compact": "32px",
        "control-mobile": "44px",
      },
      maxWidth: {
        reading: "960px",
      },
      boxShadow: {
        floating: "0 8px 24px -4px rgb(0 0 0 / 0.18)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
      },
    },
  },
  plugins: [],
};
