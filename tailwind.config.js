/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        forest: '#2A4B46',
        sage: '#8A9A86',
        orange: '#FF8A5B',
        cream: '#F9F6F0',
      },
    },
  },
  plugins: [],
}