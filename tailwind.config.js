/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDFBF7',
          100: '#F9F3E6',
          200: '#F1E3C8',
          300: '#E8CFA4',
          400: '#DEB87B',
          500: '#D4AF37', // Base Brass
          600: '#B59A5A',
          700: '#8E753E',
          800: '#6B572F',
          900: '#483A20',
          black: '#0A0A0A',
        }
      },
      fontFamily: {
        // Schibsted Grotesk is the UI typeface; system-ui covers the swap window.
        sans: ['"Schibsted Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
