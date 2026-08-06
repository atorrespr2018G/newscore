import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#b91c1c',
          soft: '#fef2f2',
          ink: '#0f172a',
          mist: '#e8eef6',
          paper: '#f4f7fb',
          line: '#d7e0ea',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 18px 40px rgba(15, 23, 42, 0.08)',
        lift: '0 10px 24px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
