/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          dark: '#0A0A0A',
          card: '#121212',
          border: '#1F2937',
          blue: '#3B82F6',
          green: '#22C55E',
          gold: '#C9A96E',
          glow: 'rgba(59, 130, 246, 0.15)'
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['Space Mono', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
