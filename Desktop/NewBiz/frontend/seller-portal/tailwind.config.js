/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
      },
      colors: {
        canvas: {
          DEFAULT: '#F3EFEA',
          subtle: '#FAF7F3',
          warm: '#ECE5DC',
        },
        sidebar: {
          DEFAULT: '#641D26',
          dark: '#52161E',
          deep: '#421017',
          active: '#7E2532',
          glow: '#9E3243',
        },
        burgundy: {
          50: '#FDF2F4',
          100: '#FCE7EA',
          200: '#F7CBD2',
          300: '#EFA4B1',
          400: '#E37286',
          500: '#C24157',
          600: '#9E2C3F',
          700: '#7E2532',
          800: '#641D26',
          900: '#52161E',
          950: '#3D0E15',
        },
      },
      boxShadow: {
        warm: '0 4px 24px -2px rgba(100, 29, 38, 0.04), 0 2px 8px -1px rgba(0, 0, 0, 0.02)',
        card: '0 10px 30px -4px rgba(70, 20, 27, 0.035), 0 2px 6px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 20px 40px -6px rgba(70, 20, 27, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03)',
        wine: '0 12px 30px -6px rgba(100, 29, 38, 0.35)',
      },
    },
  },
  plugins: [],
};
