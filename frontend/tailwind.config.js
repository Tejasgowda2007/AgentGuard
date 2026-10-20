/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        guard: {
          bg: "#090B0A",
          surface: "#101411",
          panel: "#141916",
          border: "#29322C",
          text: "#F0F4EF",
          muted: "#98A49A",
          signal: "#B7F36B",
          success: "#65D98B",
          warning: "#F2B84B",
          critical: "#FF6268",
          info: "#82B7FF",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
