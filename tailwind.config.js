/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // OneGrasp brand palette
        navy: {
          50: "#eef3fb", 100: "#d6e2f5", 200: "#aec6ec",
          300: "#7ea2dd", 400: "#4f7bcb", 500: "#2f5cb3",
          600: "#1f4490", 700: "#173672", 800: "#102a5c",
          900: "#0a1f47", 950: "#06122e",
        },
        teal: {
          50: "#e6fbfb", 100: "#c2f4f5", 200: "#8ee9eb",
          300: "#54d8dd", 400: "#22c1c9", 500: "#0aa3ac",
          600: "#08828c", 700: "#0a6770", 800: "#0d525b",
          900: "#0f444c",
        },
      },
      fontFamily: {
        display: ['"Sora"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,31,71,.04), 0 8px 24px rgba(10,31,71,.06)",
        glow: "0 0 0 1px rgba(10,163,172,.25), 0 8px 30px rgba(10,163,172,.15)",
      },
    },
  },
  plugins: [],
};
