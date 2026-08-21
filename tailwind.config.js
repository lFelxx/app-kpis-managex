/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        emerald: { DEFAULT: '#10B981', light: '#34d399', dark: '#059669' },
        cyan: { DEFAULT: '#00F2FE', light: '#22d3ee' },
      },
      borderRadius: {
        lg: '22px',
        xl: '28px',
      },
    },
  },
  plugins: [],
};
