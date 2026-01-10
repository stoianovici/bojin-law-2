/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      spacing: {
        'linear-xs': 'var(--linear-space-xs)',
        'linear-sm': 'var(--linear-space-sm)',
        'linear-md': 'var(--linear-space-md)',
        'linear-lg': 'var(--linear-space-lg)',
        'linear-xl': 'var(--linear-space-xl)',
        'linear-2xl': 'var(--linear-space-2xl)',
      },
      fontSize: {
        'linear-xs': ['var(--linear-text-xs)', { lineHeight: 'var(--linear-leading-normal)' }],
        'linear-sm': ['var(--linear-text-sm)', { lineHeight: 'var(--linear-leading-normal)' }],
        'linear-base': ['var(--linear-text-base)', { lineHeight: 'var(--linear-leading-normal)' }],
        'linear-lg': ['var(--linear-text-lg)', { lineHeight: 'var(--linear-leading-normal)' }],
        'linear-xl': ['var(--linear-text-xl)', { lineHeight: 'var(--linear-leading-tight)' }],
        'linear-2xl': ['var(--linear-text-2xl)', { lineHeight: 'var(--linear-leading-tight)' }],
      },
      lineHeight: {
        'linear-tight': 'var(--linear-leading-tight)',
        'linear-normal': 'var(--linear-leading-normal)',
        'linear-relaxed': 'var(--linear-leading-relaxed)',
      },
      borderRadius: {
        'linear-sm': 'var(--linear-radius-sm)',
        'linear-md': 'var(--linear-radius-md)',
        'linear-lg': 'var(--linear-radius-lg)',
        'linear-xl': 'var(--linear-radius-xl)',
        'linear-full': 'var(--linear-radius-full)',
      },
      boxShadow: {
        'linear-sm': 'var(--linear-shadow-sm)',
        'linear-md': 'var(--linear-shadow-md)',
        'linear-lg': 'var(--linear-shadow-lg)',
      },
      zIndex: {
        'linear-dropdown': 'var(--linear-z-dropdown)',
        'linear-sticky': 'var(--linear-z-sticky)',
        'linear-modal': 'var(--linear-z-modal)',
        'linear-popover': 'var(--linear-z-popover)',
        'linear-tooltip': 'var(--linear-z-tooltip)',
      },
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
        'linear-info': 'var(--linear-info)',
        'mobile-bg': {
          primary: 'var(--mobile-bg-primary)',
          elevated: 'var(--mobile-bg-elevated)',
          card: 'var(--mobile-bg-card)',
          hover: 'var(--mobile-bg-hover)',
          overlay: 'var(--mobile-bg-overlay)',
        },
        'mobile-text': {
          primary: 'var(--mobile-text-primary)',
          secondary: 'var(--mobile-text-secondary)',
          tertiary: 'var(--mobile-text-tertiary)',
        },
        'mobile-border': {
          DEFAULT: 'var(--mobile-border)',
          subtle: 'var(--mobile-border-subtle)',
        },
        'mobile-accent': {
          DEFAULT: 'var(--mobile-accent)',
          subtle: 'var(--mobile-accent-subtle)',
        },
        'mobile-warning': {
          DEFAULT: 'var(--mobile-warning)',
          subtle: 'var(--mobile-warning-subtle)',
        },
        'mobile-success': {
          DEFAULT: 'var(--mobile-success)',
          subtle: 'var(--mobile-success-subtle)',
        },
        'mobile-purple': {
          DEFAULT: 'var(--mobile-purple)',
          subtle: 'var(--mobile-purple-subtle)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(24px)' },
        },
        panelSlideIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        panelSlideOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOutDown: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        slideInFromBottom: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'accordion-down': {
          '0%': { height: '0', opacity: '0' },
          '100%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
        },
        'accordion-up': {
          '0%': { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          '100%': { height: '0', opacity: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        fadeOut: 'fadeOut 150ms ease-in',
        fadeInUp: 'fadeInUp 200ms ease-out',
        scaleIn: 'scaleIn 200ms ease-out',
        slideInRight: 'slideInRight 250ms cubic-bezier(0.22, 1, 0.36, 1)',
        slideOutRight: 'slideOutRight 200ms cubic-bezier(0.4, 0, 1, 1)',
        slideInUp: 'slideInUp 300ms ease-out',
        slideOutDown: 'slideOutDown 200ms ease-in',
        slideInFromBottom: 'slideInFromBottom 300ms ease-out',
        fadeInScale: 'fadeInScale 200ms ease-out',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'panel-in': 'panelSlideIn 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'panel-out': 'panelSlideOut 200ms cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [],
};
