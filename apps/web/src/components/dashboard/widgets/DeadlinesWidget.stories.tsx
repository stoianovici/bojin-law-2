import type { Meta, StoryObj } from '@storybook/react';
import { DeadlinesWidget } from './DeadlinesWidget';

/**
 * DeadlinesWidget displays timeline of deadlines for current week.
 * Shows date, deadline description, associated case, days remaining with urgent highlighting (<2 days).
 */
const meta: Meta<typeof DeadlinesWidget> = {
  title: 'Dashboard/Widgets/DeadlinesWidget',
  component: DeadlinesWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DeadlinesWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-12 h-12 bg-neutral-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
            <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-48 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există termene această săptămână</p>
    </div>
  ),
};
