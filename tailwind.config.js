/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#010409',
        lightBlue: '#48A3CC',
        darkBlue: '#022D5B',
        rain: '#5F9AAE',
        pumpkin: '#FF9D3C',
        gold: '#d4af37',
      },
      fontFamily: {
        primary: ['"Plus Jakarta Sans"', 'sans-serif'],
        secondary: ['"Playfair Display"', 'serif'],
        tertiary: ['"Roboto"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
