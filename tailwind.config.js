/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Gray scale driven by CSS variables so both themes adapt automatically.
        gray: {
          50:  'rgb(var(--gray-50)  / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--gray-950) / <alpha-value>)',
        },
        // Gold remapping of blue utilities (legacy, kept for compatibility).
        blue: {
          50:  '#fff8e1',
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
          // Structural backgrounds — driven by CSS variables.
          bg:      'rgb(var(--shoko-bg)      / <alpha-value>)',
          header:  'rgb(var(--shoko-header)  / <alpha-value>)',
          panel:   'rgb(var(--shoko-panel)   / <alpha-value>)',
          surface: 'rgb(var(--shoko-surface) / <alpha-value>)',
          input:   'rgb(var(--shoko-input)   / <alpha-value>)',
          // Border line (RGBA, not rgb-with-alpha — used without modifier).
          line: 'var(--shoko-line)',
          // Fixed accent colors (same in both themes).
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
