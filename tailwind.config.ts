import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        surface: "#f6f8fb",
        ink: "#172033",
        muted: "#59697f",
        accent: "#0f766e",
      },
    },
  },
  plugins: [],
};

export default config;
