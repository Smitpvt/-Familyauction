/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hfpl: {
          bg: '#0c0d0e',
          surface: '#151618',
          surfaceHover: '#1c1d21',
          surfaceLight: '#ffffff',
          cardBorder: '#27272a',
          cardBorderLight: '#e4e4e7',
          textPrimary: '#ffffff',
          textSecondary: '#a1a1aa',
          textMuted: '#71717a',
          // Subtle green accents
          green: '#22c55e',
          greenHover: '#16a34a',
          greenLight: 'rgba(34, 197, 94, 0.12)',
          greenBorder: 'rgba(34, 197, 94, 0.4)',
          // SOLD stamp red
          red: '#dc2626',
          redDark: '#b91c1c',
          redLight: 'rgba(220, 38, 38, 0.12)'
        }
      },
      fontFamily: {
        sans: ['"Poppins"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Poppins"', 'sans-serif'],
        sports: ['"Poppins"', 'sans-serif']
      },
      animation: {
        'stamp-in': 'stampSlam 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'subtle-pulse': 'subtlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards'
      },
      keyframes: {
        stampSlam: {
          '0%': { transform: 'scale(1.5) rotate(-22deg)', opacity: '0' },
          '70%': { transform: 'scale(0.96) rotate(-11deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-13deg)', opacity: '1' }
        },
        subtlePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}
