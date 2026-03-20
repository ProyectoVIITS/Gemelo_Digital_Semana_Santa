/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        viits: {
          bg: '#0a0f1e',
          bgAlt: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          amber: '#f59e0b',
          green: '#10b981',
          yellow: '#f59e0b',
          red: '#ef4444',
          crimson: '#7f1d1d',
          text: '#e2e8f0',
          invias: '#1e40af',
          cyan: '#0ea5e9',
          'cyan-glow': '#38bdf8',
          indigo: '#6366f1',
          surface: '#0d1a2e',
          subtle: '#1e3a5f',
        }
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 8s linear infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 4px #38bdf8' },
          '100%': { boxShadow: '0 0 16px #38bdf8, 0 0 32px #38bdf840' },
        },
        scan: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [],
}
