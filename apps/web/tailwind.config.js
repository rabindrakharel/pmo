/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Open Sans'", "'Helvetica Neue'", 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'base': '13px',
        'sm': '12px',
        'xs': '11px',
      },
      colors: {
        // Light Gray Theme - Components use "dark-*" classes that map to these light colors
        dark: {
          bg: '#EEEEEE',           // Main background - light gray
          card: '#FFFFFF',         // White for cards/panels
          border: '#D0D0D0',       // Border color
          text: '#616161',         // Default text color (dark gray)
          'text-hover': '#5B5F63', // Hover/active/highlighted text (darker gray)
          'text-active': '#5B5F63',// Active state text
          50: '#FAFAFA',           // Lightest
          100: '#FFFFFF',          // White (cards)
          200: '#EEEEEE',          // Main background
          300: '#D0D0D0',          // Borders
          400: '#BDBDBD',          // Lighter borders
          500: '#9E9E9E',          // Medium
          600: '#616161',          // Text color
          700: '#5B5F63',          // Hover/active text
          800: '#424242',          // Darker text
          900: '#212121',          // Darkest text
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
