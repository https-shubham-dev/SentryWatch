/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0A0E14',
          900: '#121821',
          800: '#1A2330',
          700: '#293241',
        },
        mist: {
          400: '#8B96A5',
          100: '#E8ECF1',
        },
        'signal-blue': '#4C8DFF',
        status: {
          ok: '#3DD68C',
          warn: '#F5B84C',
          critical: '#F0563D',
          resolved: '#6C7A91',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
