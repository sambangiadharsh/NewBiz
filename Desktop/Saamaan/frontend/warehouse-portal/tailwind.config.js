/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
      },
      colors: {
        canvas: '#F5F8F9',
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0E7A8A',
          800: '#0C6E7E',
          900: '#07525E',
          950: '#043B44',
        },
        petrol: {
          DEFAULT: '#0C6E7E',
          dark: '#07525E',
          deep: '#043B44',
          ocean: '#006E82',
          active: '#118699',
          glow: '#14B8A6',
          surface: '#EBF5F6',
        },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(12, 110, 126, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        card: '0 10px 25px -5px rgba(12, 110, 126, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        glow: '0 8px 25px -4px rgba(12, 110, 126, 0.35)',
      },
    },
  },
  plugins: [],
};
