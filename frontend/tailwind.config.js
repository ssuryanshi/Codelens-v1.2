/** @type {import('tailwindcss').Config} */

// Design tokens. Warm graphite surfaces, bone-coloured text, one accent.
// `gray` and `blue` are redefined so every existing utility (text-gray-400,
// bg-blue-600 ...) picks up the new palette without touching each component.
const stone = {
  50: '#f4f1ea',
  100: '#e9e6dc',
  200: '#d3cfc3',
  300: '#b4b0a3',
  400: '#8f8b7e',
  500: '#6f6c61',
  600: '#53514a',
  700: '#3a3934',
  800: '#292825',
  900: '#1b1b19',
  950: '#121210',
}

const accent = {
  50: '#fff3ec',
  100: '#ffe2d2',
  200: '#ffc4a5',
  300: '#ff9f70',
  400: '#f47f48',
  500: '#e8643a',
  600: '#d2502a',
  700: '#ad3f20',
  800: '#8a331d',
  900: '#6f2c1b',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: stone,
        slate: stone,
        zinc: stone,
        blue: accent,
        indigo: stone,
        violet: stone,
        purple: stone,
        ink: '#121210',
        surface: '#191917',
        raised: '#201f1c',
        line: '#2e2d29',
        bone: '#e9e6dc',
        accent: accent[500],
        dark: {
          bg: '#121210',
          surface: '#191917',
          border: '#2e2d29',
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'rise-in': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-4px)' },
          '40%,80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'rise-in': 'rise-in 420ms cubic-bezier(.2,.7,.2,1) both',
        shake: 'shake 400ms ease-in-out',
      },
    },
  },
  plugins: [],
}
