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
        // Warm Sepia Palette (v14.4.0) - Easy on eyes for long sessions
        // Based on Tailwind Stone palette with cream undertones
        // Single source of truth - no more color conflicts
        dark: {
          // Background hierarchy (warm cream tones)
          canvas: '#FAF9F7',        // Cream page background (warm off-white)
          surface: '#FEFDFB',       // Warm white for cards, panels
          subtle: '#F5F5F4',        // Subtle backgrounds (stone-100)
          hover: '#E7E5E4',         // Hover states (stone-200)
          active: '#D6D3D1',        // Active/pressed states (stone-300)
          muted: '#A8A29E',         // Muted backgrounds (stone-400)

          // Text hierarchy (softer contrast - easier on eyes)
          'text-primary': '#292524',     // Soft black (stone-800) - NOT pure black
          'text-secondary': '#57534E',   // Warm gray (stone-600)
          'text-tertiary': '#78716C',    // Muted warm gray (stone-500)
          'text-placeholder': '#A8A29E', // Placeholders (stone-400)
          'text-disabled': '#D6D3D1',    // Disabled text (stone-300)

          // Border hierarchy (warm tones)
          'border-default': '#E7E5E4',   // Default borders (stone-200)
          'border-subtle': '#F5F5F4',    // Subtle borders (stone-100)
          'border-medium': '#D6D3D1',    // Medium emphasis (stone-300)
          'border-strong': '#A8A29E',    // Strong emphasis (stone-400)

          // Primary accent - Warm Stone (unified across all interactions)
          accent: '#57534E',             // Primary actions (stone-600)
          'accent-hover': '#44403C',     // Hover state (stone-700)
          'accent-light': '#78716C',     // Light variant (stone-500)
          'accent-bg': '#F5F5F4',        // Background tint (stone-100)
          'accent-ring': 'rgba(87, 83, 78, 0.25)', // Focus ring (stone-600 @ 25%)

          // Semantic colors (unchanged - these need to pop)
          success: '#059669',            // Success (emerald-600)
          'success-bg': '#ECFDF5',       // Success background
          warning: '#D97706',            // Warning (amber-600)
          'warning-bg': '#FFFBEB',       // Warning background
          error: '#DC2626',              // Error (red-600)
          'error-bg': '#FEF2F2',         // Error background
          info: '#0284C7',               // Info (sky-600)
          'info-bg': '#F0F9FF',          // Info background

          // Numbered scale (warm stone tones for backwards compatibility)
          50: '#FAFAF9',    // stone-50
          100: '#F5F5F4',   // stone-100
          200: '#E7E5E4',   // stone-200
          300: '#D6D3D1',   // stone-300
          400: '#A8A29E',   // stone-400
          500: '#78716C',   // stone-500
          600: '#57534E',   // stone-600
          700: '#44403C',   // stone-700
          800: '#292524',   // stone-800
          900: '#1C1917',   // stone-900
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
