/**
 * TimeEntriesTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TimeEntriesTab } from './TimeEntriesTab';

const meta: Meta<typeof TimeEntriesTab> = {
  title: 'Case/Tabs/TimeEntriesTab',
  component: TimeEntriesTab,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TimeEntriesTab>;

/**
 * Default placeholder view
 */
export const Default: Story = {
  args: {},
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
