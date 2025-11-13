/**
 * CommunicationsTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { CommunicationsTab } from './CommunicationsTab';

const meta: Meta<typeof CommunicationsTab> = {
  title: 'Case/Tabs/CommunicationsTab',
  component: CommunicationsTab,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommunicationsTab>;

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
