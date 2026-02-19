/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        s: {
          bg:       '#070710',
          deep:     '#0c0c1a',
          surface:  '#11111f',
          card:     '#16162a',
          border:   '#252540',
          hover:    '#1e1e38',
          violet:   '#8b5cf6',
          indigo:   '#6366f1',
          pink:     '#ec4899',
          cyan:     '#06b6d4',
          green:    '#10b981',
          amber:    '#f59e0b',
          text:     '#e2e2f0',
          sub:      '#9090b0',
          muted:    '#55556a',
        },
      },
      backgroundImage: {
        'disc-gradient': 'conic-gradient(from 0deg, #8b5cf622, #6366f133, #06b6d422, #8b5cf622)',
        'vinyl-grooves': 'repeating-radial-gradient(circle at center, transparent 0, transparent 4px, rgba(139,92,246,0.04) 4px, rgba(139,92,246,0.04) 5px)',
        'grid-fine': 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
        'glow-violet': 'radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
      boxShadow: {
        'disc': '0 0 60px rgba(139,92,246,0.2), 0 0 120px rgba(99,102,241,0.1)',
        'glow-sm': '0 0 20px rgba(139,92,246,0.3)',
        'glow-md': '0 0 40px rgba(139,92,246,0.25)',
        'inner-disc': 'inset 0 0 40px rgba(0,0,0,0.8)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'spin-disc': 'spin 12s linear infinite',
        'spin-disc-slow': 'spin 20s linear infinite',
        'spin-disc-paused': 'spin 12s linear infinite paused',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
        'eq-bar': 'eqBar 1.2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        eqBar: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
