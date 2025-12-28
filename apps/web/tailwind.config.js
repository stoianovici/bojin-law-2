/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Linear-inspired semantic colors (use CSS variables for theme switching)
        'linear-bg': {
          primary: 'var(--linear-bg-primary)',
          secondary: 'var(--linear-bg-secondary)',
          tertiary: 'var(--linear-bg-tertiary)',
          elevated: 'var(--linear-bg-elevated)',
          hover: 'var(--linear-bg-hover)',
        },
        'linear-accent': {
          DEFAULT: 'var(--linear-accent)',
          hover: 'var(--linear-accent-hover)',
          muted: 'var(--linear-accent-muted)',
        },
        'linear-text': {
          primary: 'var(--linear-text-primary)',
          secondary: 'var(--linear-text-secondary)',
          tertiary: 'var(--linear-text-tertiary)',
          muted: 'var(--linear-text-muted)',
        },
        'linear-border': {
          subtle: 'var(--linear-border-subtle)',
          DEFAULT: 'var(--linear-border-default)',
        },
        'linear-success': 'var(--linear-success)',
        'linear-warning': 'var(--linear-warning)',
        'linear-error': 'var(--linear-error)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      keyframes: {
        slideDown: {
          from: { height: '0', opacity: '0' },
          to: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
        },
        slideUp: {
          from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          to: { height: '0', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        expandHeight: {
          '0%': { height: '0', opacity: '0' },
          '100%': { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
        },
        collapseHeight: {
          '0%': { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
          '100%': { height: '0', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
      },
      animation: {
        slideDown: 'slideDown 200ms ease-out',
        slideUp: 'slideUp 200ms ease-out',
        fadeIn: 'fadeIn 200ms ease-out',
        fadeInUp: 'fadeInUp 200ms ease-out',
        fadeInDown: 'fadeInDown 200ms ease-out',
        scaleIn: 'scaleIn 200ms ease-out',
        shimmer: 'shimmer 2s infinite linear',
        expandHeight: 'expandHeight 200ms ease-out',
        collapseHeight: 'collapseHeight 200ms ease-out',
        shake: 'shake 400ms ease-in-out',
      },
    },
  },
  plugins: [],
};
