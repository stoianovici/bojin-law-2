/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Superhuman-inspired dark theme
        bg: {
          primary: 'var(--bg-primary)',
          elevated: 'var(--bg-elevated)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          muted: 'var(--accent-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
        sm: ['0.8125rem', { lineHeight: '1.125rem' }], // 13px
        base: ['0.9375rem', { lineHeight: '1.375rem' }], // 15px
        lg: ['1.0625rem', { lineHeight: '1.5rem' }], // 17px
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
      },
      borderRadius: {
        sm: '0.375rem', // 6px
        DEFAULT: '0.5rem', // 8px
        md: '0.625rem', // 10px
        lg: '0.75rem', // 12px
        xl: '1rem', // 16px
        '2xl': '1.25rem', // 20px
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        slideUp: 'slideUp 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        slideDown: 'slideDown 200ms ease-in',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
