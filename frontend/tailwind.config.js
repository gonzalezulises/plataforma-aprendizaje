/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Rizoma brand colors (matching rizo.ma)
        rizoma: {
          green: {
            DEFAULT: '#289448',
            light: '#34A856',
            dark: '#1F7038',
            muted: '#4CAF6A',
          },
          cyan: {
            DEFAULT: '#1FACC0',
            light: '#3FC5D6',
            dark: '#178A9A',
          },
        },
        // Primary color now uses rizoma-green
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#289448',
          600: '#289448',
          700: '#1F7038',
          800: '#166534',
          900: '#14532d',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#289448',
          600: '#1F7038',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
        // Gray scale from rizo.ma
        gray: {
          50: '#F9FAFB',
          100: '#FEF6ED',
          200: '#D7D7D7',
          300: '#B0B0B0',
          400: '#767574',
          500: '#5F5F5F',
          600: '#525150',
          700: '#383838',
          800: '#2d2d2d',
          900: '#151414',
          950: '#080808',
        },
      },
      fontFamily: {
        // Matching rizo.ma typography
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          '"Source Serif 4"',
          'ui-serif',
          'Georgia',
          'serif',
        ],
        heading: [
          '"Source Serif 4"',
          'ui-serif',
          'Georgia',
          'serif',
        ],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
