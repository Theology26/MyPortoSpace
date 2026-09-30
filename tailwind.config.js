/** @type {import('tailwindcss').Config} */
// Palette for the public portfolio (index.html).
module.exports = {
  content: ['./index.html', './src/client/app.jsx'],
  theme: {
    extend: {
      fontFamily: {
        geist: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        space: {
          black: '#08080a',
          900: '#0e0e12',
          800: '#141418',
          700: '#1a1a20',
          600: '#222228',
        },
        glass: {
          border: 'rgba(255, 255, 255, 0.12)',
          bg: 'rgba(255, 255, 255, 0.05)',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
        muted: '#c4c7c8',
        subtle: '#e5e1e4',
      },
    },
  },
  plugins: [],
};
