import type { Meta, StoryObj } from '@storybook/react';
import { AssociateDashboard } from './AssociateDashboard';

/**
 * AssociateDashboard displays active cases, today's tasks, deadlines,
 * recent documents, and AI suggestions tailored for Associate role.
 */
const meta: Meta<typeof AssociateDashboard> = {
  title: 'Dashboard/Pages/AssociateDashboard',
  component: AssociateDashboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AssociateDashboard>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="p-6">
      <div className="mb-4">
        <div className="h-8 w-48 bg-neutral-200 rounded animate-pulse"></div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-6 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-4 h-48 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-8 h-48 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-12 h-40 bg-neutral-200 rounded-lg animate-pulse"></div>
      </div>
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};
