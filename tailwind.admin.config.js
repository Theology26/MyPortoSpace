/** @type {import('tailwindcss').Config} */
// Palette for the admin dashboard (admin.html) — intentionally separate from
// the public site config because `muted`/`subtle` differ between the two.
module.exports = {
  content: ['./admin.html', './src/client/admin.jsx'],
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
        muted: '#94a3b8',
        subtle: '#e2e8f0',
      },
    },
  },
  plugins: [],
};
