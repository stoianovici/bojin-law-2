/**
 * Office Theme Detection Service
 *
 * Detects and responds to Office theme changes (light/dark mode).
 */

import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

/**
 * Detect Office theme from Office.context.officeTheme
 */
function detectOfficeTheme(): ThemeMode {
  try {
    if (typeof Office !== 'undefined' && Office.context?.officeTheme) {
      const theme = Office.context.officeTheme;
      // Office provides bodyBackgroundColor - dark themes have dark backgrounds
      const bgColor = theme.bodyBackgroundColor?.toLowerCase() || '';

      // Check if background is dark (low luminance)
      if (bgColor) {
        const rgb = hexToRgb(bgColor);
        if (rgb) {
          const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
          return luminance < 0.5 ? 'dark' : 'light';
        }
      }
    }
  } catch (e) {
    console.warn('[Theme] Could not detect Office theme:', e);
  }

  // Default to light theme, but also check system preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle shorthand (e.g., "fff")
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  if (hex.length !== 6) return null;

  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);

  // Also set color-scheme for native elements
  document.documentElement.style.colorScheme = theme;
}

/**
 * Hook to get and respond to Office theme changes
 */
export function useOfficeTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(() => detectOfficeTheme());

  useEffect(() => {
    // Apply initial theme
    applyTheme(theme);

    // Listen for Office theme changes (if available)
    if (typeof Office !== 'undefined' && Office.context?.document) {
      try {
        // Office doesn't have a theme change event, but we can poll
        const checkTheme = () => {
          const newTheme = detectOfficeTheme();
          if (newTheme !== theme) {
            setTheme(newTheme);
            applyTheme(newTheme);
          }
        };

        // Check periodically (Office theme can change)
        const interval = setInterval(checkTheme, 5000);
        return () => clearInterval(interval);
      } catch (e) {
        console.warn('[Theme] Could not set up theme listener:', e);
      }
    }

    // Listen for system preference changes as fallback
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setTheme(newTheme);
      applyTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return theme;
}

/**
 * Initialize theme on app load (call before React renders)
 */
export function initializeTheme(): void {
  const theme = detectOfficeTheme();
  applyTheme(theme);
}
