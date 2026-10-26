import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";
import plugin from "tailwindcss/plugin";

// ── Themable accent hues ──────────────────────────────────────────────────────
// Accent hues are emitted as CSS variables (with the normal palette as fallback) so an
// app can restyle them without touching markup. HRMS uses this for a calm, Notion-like
// neutral look: [data-app="hrms"] remaps every decorative hue to the neutral scale.
// red / green / amber are left alone because they carry status meaning.
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
const PURPLE: Record<string, string> = {
  50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc",
  500: "#a855f7", 600: "#9333ea", 700: "#7c3aed", 800: "#6d28d9", 900: "#5b21b6", 950: "#3b0764",
};
const NEUTRAL_HUES = ["purple", "violet", "indigo", "blue", "sky", "cyan", "teal", "emerald", "lime", "yellow", "orange", "fuchsia", "pink", "rose"] as const;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const paletteOf = (hue: string): Record<string, string> =>
  hue === "purple" ? PURPLE : (defaultColors as unknown as Record<string, Record<string, string>>)[hue];

const themableColors = Object.fromEntries(
  NEUTRAL_HUES.map((hue) => [
    hue,
    Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--hue-${hue}-${shade}, ${hexToRgb(paletteOf(hue)[shade])}) / <alpha-value>)`])),
  ]),
);

const neutralTheme = plugin(({ addBase }) => {
  const neutral = (defaultColors as unknown as Record<string, Record<string, string>>).neutral;
  const vars: Record<string, string> = {};
  for (const hue of NEUTRAL_HUES) for (const shade of SHADES) vars[`--hue-${hue}-${shade}`] = hexToRgb(neutral[shade]);
  addBase({
    '[data-app="hrms"]': {
      ...vars,
      "--primary": "0 0% 9%",
      "--primary-foreground": "0 0% 98%",
      "--ring": "0 0% 45%",
      "--sidebar-primary": "0 0% 9%",
      "--sidebar-ring": "0 0% 45%",
    },
    '.dark[data-app="hrms"], .dark [data-app="hrms"], [data-app="hrms"] .dark': {
      "--primary": "0 0% 93%",
      "--primary-foreground": "0 0% 9%",
    },
  });
});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
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
        ...themableColors,
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
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-left": "slide-in-left 0.15s ease-out",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [neutralTheme],
};

export default config;
