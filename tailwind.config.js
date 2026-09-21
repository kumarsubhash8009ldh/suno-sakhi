/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sakhi: {
          dark: '#0a0612',
          card: '#150d24',
          surface: '#1e1233',
          border: '#381e5e',
          pink: '#ff2e93',
          purple: '#9d4edd',
          rose: '#ff5c8d',
          gold: '#ffd166',
          cyan: '#00f5d4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'wave-bar-1': 'wave 1s ease-in-out infinite',
        'wave-bar-2': 'wave 1.2s ease-in-out 0.2s infinite',
        'wave-bar-3': 'wave 0.8s ease-in-out 0.4s infinite',
        'wave-bar-4': 'wave 1.4s ease-in-out 0.1s infinite',
        'wave-bar-5': 'wave 0.9s ease-in-out 0.3s infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { height: '12px' },
          '50%': { height: '48px' },
        }
      }
    },
  },
  plugins: [],
}
