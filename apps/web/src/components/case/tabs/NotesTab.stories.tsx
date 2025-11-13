/**
 * NotesTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NotesTab } from './NotesTab';

const meta: Meta<typeof NotesTab> = {
  title: 'Case/Tabs/NotesTab',
  component: NotesTab,
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
type Story = StoryObj<typeof NotesTab>;

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
