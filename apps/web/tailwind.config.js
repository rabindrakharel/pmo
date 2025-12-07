/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Production-grade font stack with system fallbacks
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Fira Code',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      fontSize: {
        // Refined typography scale - production clarity
        '3xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'xs': ['12px', { lineHeight: '18px' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['30px', { lineHeight: '36px' }],
      },
      colors: {
        // Production-Grade Neutral Palette (Notion/Linear inspired)
        // Single source of truth - no more color conflicts
        dark: {
          // Background hierarchy
          canvas: '#FAFAFA',        // Page background
          surface: '#FFFFFF',       // Cards, panels
          subtle: '#F7F7F7',        // Subtle backgrounds
          hover: '#F3F3F3',         // Hover states
          active: '#EBEBEB',        // Active/pressed states
          muted: '#E5E5E5',         // Muted backgrounds

          // Text hierarchy (high contrast for readability)
          'text-primary': '#1A1A1A',     // Primary text - near black
          'text-secondary': '#6B6B6B',   // Secondary text
          'text-tertiary': '#8F8F8F',    // Tertiary/muted text
          'text-placeholder': '#ABABAB', // Placeholders
          'text-disabled': '#C4C4C4',    // Disabled text

          // Border hierarchy
          'border-default': '#E5E5E5',   // Default borders
          'border-subtle': '#EBEBEB',    // Subtle borders
          'border-medium': '#D4D4D4',    // Medium emphasis
          'border-strong': '#B3B3B3',    // Strong emphasis

          // Primary accent - Slate (unified across all interactions)
          accent: '#475569',             // Primary actions (slate-600)
          'accent-hover': '#334155',     // Hover state (slate-700)
          'accent-light': '#64748B',     // Light variant (slate-500)
          'accent-bg': '#F1F5F9',        // Background tint (slate-100)
          'accent-ring': 'rgba(71, 85, 105, 0.25)', // Focus ring

          // Semantic colors
          success: '#059669',            // Success (emerald-600)
          'success-bg': '#ECFDF5',       // Success background
          warning: '#D97706',            // Warning (amber-600)
          'warning-bg': '#FFFBEB',       // Warning background
          error: '#DC2626',              // Error (red-600)
          'error-bg': '#FEF2F2',         // Error background
          info: '#0284C7',               // Info (sky-600)
          'info-bg': '#F0F9FF',          // Info background

          // Numbered scale (backwards compatibility)
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
      boxShadow: {
        // Production shadows - subtle and refined
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
        'focus': '0 0 0 3px rgba(71, 85, 105, 0.15)',
      },
      borderRadius: {
        // Consistent border radius scale
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'scale-in': 'scaleIn 150ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Only apply to elements with form classes
    }),
  ],
}
