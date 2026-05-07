/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        shoko: {
          bg: '#0d0d1a',
          bg2: '#1a1a2e',
          panel: '#0d0d1a',
          line: 'rgba(55, 65, 81, 0.5)',
          accent: '#3b82f6',
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
