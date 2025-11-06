/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "'Open Sans'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Standardized typography scale for consistent UI
        'base': '14px',      // Body text - primary content
        'sm': '13px',        // Small text - secondary content
        'xs': '12px',        // Tiny text - labels, captions
        '2xs': '11px',       // Micro text - metadata
        '3xs': '10px',       // Ultra-micro - uppercase labels
      },
      colors: {
        // Soft Slate Theme - Notion-inspired premium color palette
        // Components use "dark-*" classes that map to these Soft Slate colors
        dark: {
          // Semantic colors (for clarity)
          canvas: '#FAFAFA',       // Main canvas background - ultra-light warm gray
          surface: '#FFFFFF',      // Cards, panels, elevated surfaces
          hover: '#F5F5F5',        // Subtle hover states
          active: '#F0F0F0',       // Active/selected states

          // Text hierarchy
          'text-primary': '#37352F',   // Primary content - soft black
          'text-secondary': '#787774', // Secondary content - warm gray
          'text-tertiary': '#9B9A97',  // Tertiary content - light gray
          'text-placeholder': '#C2C1BE', // Placeholders, disabled

          // Borders & dividers
          'border-default': '#E9E9E7', // Default borders - barely visible
          'border-medium': '#DFDFDD',  // Medium borders
          'border-strong': '#D5D5D3',  // Strong borders

          // Accents
          accent: '#2383E2',       // Primary actions - Notion blue
          'accent-hover': '#1A6FCC', // Hover state
          'accent-bg': '#E7F3FF',  // Light blue backgrounds

          // Semantic colors
          success: '#0F7B6C',      // Success states
          warning: '#D9730D',      // Warning states
          error: '#E03E3E',        // Error states
          info: '#2383E2',         // Info states

          // Numbered scale (for compatibility with existing components)
          50: '#FAFAFA',           // Lightest - canvas
          100: '#FFFFFF',          // White - surfaces
          200: '#F5F5F5',          // Hover backgrounds
          300: '#E9E9E7',          // Subtle borders
          400: '#DFDFDD',          // Medium borders
          500: '#9B9A97',          // Tertiary text
          600: '#787774',          // Secondary text
          700: '#37352F',          // Primary text
          800: '#2C2A26',          // Darker text
          900: '#1F1D1A',          // Darkest text
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
