import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)", // #00B3B7 - Cyan/Teal
        paragraph: "var(--paragraph)", // #64748B - Slate gray
        heading: "var(--heading)", // #1A1D1B - Charcoal
      },
    },
  },
  plugins: [],
};
export default config;
