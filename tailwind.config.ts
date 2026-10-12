import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#d7dee7",
        surface: "#f6f8fa",
        ink: "#18212f",
        muted: "#526174",
        accent: "#0f766e",
      },
    },
  },
  plugins: [],
};

export default config;
