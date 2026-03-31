/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0D1B2A", light: "#1B2838", dark: "#070F18" },
        gold: { DEFAULT: "#C9A84C", light: "#D4BA6A", dark: "#A88A3A" },
      },
      fontFamily: {
        heading: ['"Playfair Display"', "serif"],
        body: ['"Source Sans 3"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
