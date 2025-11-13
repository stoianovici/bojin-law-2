/**
 * CaseWorkspacePage Storybook Stories
 * Full page story demonstrating the complete case workspace
 */

import type { Meta, StoryObj } from '@storybook/react';
import CaseWorkspacePage from './page';

const meta: Meta<typeof CaseWorkspacePage> = {
  title: 'Pages/CaseWorkspacePage',
  component: CaseWorkspacePage,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CaseWorkspacePage>;

/**
 * Default workspace page state
 * Note: This story demonstrates the full workspace with all components integrated
 */
export const Default: Story = {
  args: {
    params: Promise.resolve({
      caseId: 'mock-case-123',
    }),
  },
};

/**
 * Loading state
 * Shows skeleton while case data loads
 */
export const Loading: Story = {
  args: {
    params: Promise.resolve({
      caseId: 'loading-case',
    }),
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    params: Promise.resolve({
      caseId: 'mobile-case',
    }),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    params: Promise.resolve({
      caseId: 'tablet-case',
    }),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
