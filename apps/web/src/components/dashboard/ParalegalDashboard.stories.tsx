import type { Meta, StoryObj } from '@storybook/react';
import { ParalegalDashboard } from './ParalegalDashboard';

/**
 * ParalegalDashboard displays assigned tasks (Kanban board), document requests,
 * deadline calendar, and AI suggestions tailored for Paralegal role.
 */
const meta: Meta<typeof ParalegalDashboard> = {
  title: 'Dashboard/Pages/ParalegalDashboard',
  component: ParalegalDashboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ParalegalDashboard>;

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
        <div className="col-span-8 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-4 h-64 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-6 h-80 bg-neutral-200 rounded-lg animate-pulse"></div>
        <div className="col-span-6 h-80 bg-neutral-200 rounded-lg animate-pulse"></div>
      </div>
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};
