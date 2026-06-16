/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0071E3',
          accent: '#5856D6',
          dark: '#FFFFFF',
          surface: '#F5F5F7',
          'surface-raised': '#FAFAFA',
          text: '#1D1D1F',
          muted: '#6E6E73',
          tertiary: '#86868B',
          border: '#D2D2D7',
          success: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30',
          blue: '#007AFF',
          indigo: '#5856D6',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"SF Pro Text"', '"Helvetica Neue"', 'sans-serif',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
