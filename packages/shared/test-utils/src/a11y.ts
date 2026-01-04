/**
 * Accessibility Testing Utilities
 * Provides helpers for testing WCAG AA compliance using axe-core
 */

import type { Page } from '@playwright/test';
import {
  injectAxe,
  checkA11y as axeCheckA11y,
  getViolations as axeGetViolations,
} from 'axe-playwright';
import type { Result, ElementContext, RunOptions, ImpactValue } from 'axe-core';

/**
 * Axe-playwright specific options that wrap RunOptions
 */
interface AxePlaywrightOptions {
  includedImpacts?: ImpactValue[];
  detailedReport?: boolean;
  detailedReportOptions?: {
    html?: boolean;
  };
  verbose?: boolean;
  axeOptions?: RunOptions;
}

/**
 * Configuration for axe-core accessibility tests
 * Targets WCAG AA compliance as specified in requirements
 */
export const axeConfig: RunOptions = {
  runOnly: {
    type: 'tag',
    values: [
      'wcag2a', // WCAG 2.0 Level A
      'wcag2aa', // WCAG 2.0 Level AA
      'wcag21a', // WCAG 2.1 Level A
      'wcag21aa', // WCAG 2.1 Level AA
      'wcag22aa', // WCAG 2.2 Level AA
      'best-practice', // Industry best practices
    ],
  },
};

/**
 * Rules to disable for specific test scenarios
 * Use sparingly and only when necessary with proper justification
 */
export const getAxeConfigWithDisabledRules = (disabledRules: string[]): RunOptions => ({
  ...axeConfig,
  rules: disabledRules.reduce(
    (acc, rule) => ({
      ...acc,
      [rule]: { enabled: false },
    }),
    {}
  ),
});

/**
 * Convert RunOptions to AxePlaywrightOptions format
 */
function toAxePlaywrightOptions(options: RunOptions): AxePlaywrightOptions {
  return { axeOptions: options };
}

/**
 * Test accessibility of a Playwright page
 * Injects axe-core and runs accessibility checks
 *
 * @param page - Playwright page instance
 * @param context - Optional CSS selector or Element to test (default: entire page)
 * @param options - Optional axe-core configuration
 * @returns Promise that resolves when accessibility checks pass
 *
 * @example
 * test('Dashboard is accessible', async ({ page }) => {
 *   await page.goto('http://localhost:3000/dashboard');
 *   await testA11y(page);
 * });
 *
 * @example
 * test('Specific component is accessible', async ({ page }) => {
 *   await page.goto('http://localhost:3000/dashboard');
 *   await testA11y(page, '#main-content');
 * });
 */
export async function testA11y(
  page: Page,
  context?: ElementContext,
  options: RunOptions = axeConfig
): Promise<void> {
  try {
    // Type assertion needed due to playwright version mismatch with axe-playwright
    await injectAxe(page as any);
    await axeCheckA11y(page as any, context, toAxePlaywrightOptions(options));
  } catch (error) {
    // Re-throw with more helpful error message
    if (error instanceof Error) {
      throw new Error(
        `Accessibility violations found: ${error.message}\n\n` +
          'Run with --headed flag to see visual issues, or check the error details above.'
      );
    }
    throw error;
  }
}

/**
 * Get accessibility violations without throwing
 * Useful for custom assertions or reporting
 *
 * @param page - Playwright page instance
 * @param context - Optional CSS selector or Element to test
 * @param options - Optional axe-core configuration
 * @returns Promise resolving to array of violations
 *
 * @example
 * const violations = await getA11yViolations(page);
 * expect(violations.length).toBe(0);
 */
export async function getA11yViolations(
  page: Page,
  context?: ElementContext,
  options: RunOptions = axeConfig
): Promise<Result[]> {
  // Type assertion needed due to playwright version mismatch with axe-playwright
  await injectAxe(page as any);
  return axeGetViolations(page as any, context, options);
}

/**
 * Test specific accessibility rule
 *
 * @param page - Playwright page instance
 * @param ruleId - Axe rule ID to test (e.g., 'color-contrast', 'label')
 * @param context - Optional CSS selector or Element to test
 * @returns Promise that resolves when rule passes
 *
 * @example
 * await testA11yRule(page, 'color-contrast');
 */
export async function testA11yRule(
  page: Page,
  ruleId: string,
  context?: ElementContext
): Promise<void> {
  const options: RunOptions = {
    runOnly: {
      type: 'rule',
      values: [ruleId],
    },
  };

  await testA11y(page, context, options);
}

/**
 * Format violation details for better error messages
 *
 * @param violations - Array of axe violations
 * @returns Formatted string with violation details
 */
export function formatViolations(violations: Result[]): string {
  if (violations.length === 0) {
    return 'No violations found';
  }

  return violations
    .map((violation, index) => {
      const nodeInfo = violation.nodes
        .map((node: any) => {
          const target = Array.isArray(node.target) ? node.target.join(' ') : node.target;
          return `      Selector: ${target}\n      HTML: ${node.html}`;
        })
        .join('\n\n');

      return (
        `${index + 1}. ${violation.id} (${violation.impact})\n` +
        `   Description: ${violation.description}\n` +
        `   Help: ${violation.help}\n` +
        `   Help URL: ${violation.helpUrl}\n` +
        `   Affected elements (${violation.nodes.length}):\n${nodeInfo}`
      );
    })
    .join('\n\n');
}

/**
 * Common accessibility test scenarios
 */
export const a11yTestScenarios = {
  /**
   * Test page has proper landmark regions
   */
  landmarks: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'region');
  },

  /**
   * Test all images have alt text
   */
  images: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'image-alt');
  },

  /**
   * Test form inputs have labels
   */
  formLabels: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'label');
  },

  /**
   * Test color contrast meets WCAG AA requirements
   */
  colorContrast: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'color-contrast');
  },

  /**
   * Test heading hierarchy is correct
   */
  headings: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'heading-order');
  },

  /**
   * Test keyboard navigation
   */
  keyboard: async (page: Page): Promise<void> => {
    await testA11yRule(page, 'focus-order-semantics');
  },

  /**
   * Test ARIA attributes are used correctly
   */
  aria: async (page: Page): Promise<void> => {
    const ariaRules = [
      'aria-allowed-attr',
      'aria-required-attr',
      'aria-required-children',
      'aria-required-parent',
      'aria-roles',
      'aria-valid-attr',
      'aria-valid-attr-value',
    ];

    for (const rule of ariaRules) {
      await testA11yRule(page, rule);
    }
  },
};

/**
 * Jest matcher type for toHaveNoViolations
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}

/**
 * Export jest-axe utilities for use in Jest tests
 */
export { toHaveNoViolations } from 'jest-axe';
