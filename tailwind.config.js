/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#fff8e1',
          100: '#ffecb3',
          200: '#ffe082',
          300: '#ffd54f',
          400: '#ffca28',
          500: '#d4af37',
          600: '#b88a18',
          700: '#8f6810',
          800: '#66490c',
          900: '#3a2a08',
          950: '#1f1604',
        },
        shoko: {
          bg: '#050505',
          bg2: '#11100c',
          panel: '#0a0a0a',
          line: 'rgba(212, 175, 55, 0.24)',
          accent: '#d4af37',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        panel: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
