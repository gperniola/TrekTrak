import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        /*
         * La scala grigia e i pochi accenti usati come TESTO passano per variabili CSS
         * (task-35). Cosi' il tema chiaro si ottiene rovesciando i valori in
         * `src/app/tema.css`, senza toccare i 690 usi sparsi nei componenti.
         *
         * Formato a canali con `<alpha-value>`: serve perche' `bg-white/5` e
         * `bg-gray-800/60` continuino a funzionare.
         */
        gray: {
          100: "rgb(var(--grigio-100) / <alpha-value>)",
          200: "rgb(var(--grigio-200) / <alpha-value>)",
          300: "rgb(var(--grigio-300) / <alpha-value>)",
          400: "rgb(var(--grigio-400) / <alpha-value>)",
          500: "rgb(var(--grigio-500) / <alpha-value>)",
          600: "rgb(var(--grigio-600) / <alpha-value>)",
          700: "rgb(var(--grigio-700) / <alpha-value>)",
          800: "rgb(var(--grigio-800) / <alpha-value>)",
          900: "rgb(var(--grigio-900) / <alpha-value>)",
          950: "rgb(var(--grigio-950) / <alpha-value>)",
        },
        white: "rgb(var(--bianco) / <alpha-value>)",
        green: {
          300: "rgb(var(--verde-300) / <alpha-value>)",
          400: "rgb(var(--verde-400) / <alpha-value>)",
        },
        red: {
          200: "rgb(var(--rosso-200) / <alpha-value>)",
          300: "rgb(var(--rosso-300) / <alpha-value>)",
          400: "rgb(var(--rosso-400) / <alpha-value>)",
        },
        amber: {
          100: "rgb(var(--ambra-100) / <alpha-value>)",
          300: "rgb(var(--ambra-300) / <alpha-value>)",
          400: "rgb(var(--ambra-400) / <alpha-value>)",
        },
        blue: {
          300: "rgb(var(--blu-300) / <alpha-value>)",
          400: "rgb(var(--blu-400) / <alpha-value>)",
        },
        yellow: { 300: "rgb(var(--giallo-300) / <alpha-value>)" },
        purple: {
          300: "rgb(var(--viola-300) / <alpha-value>)",
          400: "rgb(var(--viola-400) / <alpha-value>)",
        },
        orange: { 300: "rgb(var(--arancio-300) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
};
export default config;
