/**
 * QuickActionsBar Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { QuickActionsBar } from './QuickActionsBar';

const meta: Meta<typeof QuickActionsBar> = {
  title: 'Case/QuickActionsBar',
  component: QuickActionsBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuickActionsBar>;

/**
 * Default state (visible by default for Storybook)
 */
export const Default: Story = {
  args: {
    onSubmit: (input) => alert(`Submitted: ${input}`),
    onSuggestionClick: (suggestion) => alert(`Suggestion clicked: ${suggestion}`),
  },
};

/**
 * With interaction handlers
 */
export const WithHandlers: Story = {
  args: {
    onSubmit: (input) => {
      console.log('Quick action submitted:', input);
      alert(`Ați trimis: "${input}"\n\nAceasta ar declanșa o acțiune în aplicația reală.`);
    },
    onSuggestionClick: (suggestion) => {
      console.log('Suggestion clicked:', suggestion);
      alert(`Sugestie selectată: "${suggestion}"\n\nCampul de introducere va fi populat.`);
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...Default.args,
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
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
