import { waitFor } from '@testing-library/react';

/**
 * Wait for loading indicators to finish
 * Useful when testing components that show loading states
 */
export async function waitForLoadingToFinish(): Promise<void> {
  await waitFor(
    () => {
      const loadingElements = document.querySelectorAll('[aria-busy="true"], [role="progressbar"], [data-loading="true"]');
      if (loadingElements.length > 0) {
        throw new Error('Still loading');
      }
    },
    { timeout: 5000 }
  );
}

/**
 * Wait for an element to disappear from the DOM by CSS selector
 */
export async function waitForElementRemoval(selector: string): Promise<void> {
  await waitFor(
    () => {
      const element = document.querySelector(selector);
      if (element) {
        throw new Error(`Element ${selector} still exists`);
      }
    },
    { timeout: 5000 }
  );
}

/**
 * Wait for a specific number of milliseconds
 * Use sparingly - prefer waitFor with specific conditions
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
