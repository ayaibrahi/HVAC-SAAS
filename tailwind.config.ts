import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#d6dde5",
        surface: "#f7f9fb",
        ink: "#16202a",
        muted: "#5d6b78",
        accent: "#0f766e",
      },
    },
  },
  plugins: [],
};

export default config;
