/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ee', 100: '#fdedd6', 200: '#f9d5ac', 300: '#f5b677',
          400: '#f08f40', 500: '#ec721b', 600: '#dd5911', 700: '#b74211',
          800: '#923615', 900: '#762f14',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
