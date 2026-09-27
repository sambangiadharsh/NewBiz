/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
      },
      colors: {
        canvas: '#F8F9FE',
        brand: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          primary: '#635BFF',
          secondary: '#7C5CFC',
        },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(99, 102, 241, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        card: '0 10px 25px -5px rgba(99, 102, 241, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        glow: '0 8px 20px -4px rgba(124, 58, 237, 0.35)',
      },
    },
  },
  plugins: [],
};
