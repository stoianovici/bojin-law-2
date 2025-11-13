/**
 * Type declarations for jest-axe
 * jest-axe doesn't include type definitions, so we declare them here
 */
declare module 'jest-axe' {
  import type { Result } from 'axe-core';

  export function toHaveNoViolations(): {
    toHaveNoViolations(): void;
  };

  export function configureAxe(options: any): any;
}
