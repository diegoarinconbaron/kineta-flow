/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        noche: { DEFAULT: '#0E1330', 800: '#161C40', 700: '#20285A', 600: '#2D3670' },
        indigo: { 50: '#EEF0FE', 100: '#E0E3FD', 200: '#C3C8FB', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA' },
        exito: '#16A34A',
        alerta: '#F59E0B',
        urgente: '#DC2626',
        fondo: '#F5F6FA',
      },
      boxShadow: { tarjeta: '0 1px 2px rgba(14,19,48,.06), 0 1px 3px rgba(14,19,48,.08)' },
    },
  },
  plugins: [],
}
