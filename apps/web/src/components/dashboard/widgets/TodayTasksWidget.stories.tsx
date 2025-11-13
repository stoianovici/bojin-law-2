import type { Meta, StoryObj } from '@storybook/react';
import { TodayTasksWidget } from './TodayTasksWidget';

/**
 * TodayTasksWidget displays tasks due today with priority indicators and checkboxes.
 * Shows task title, case context, priority badge (High: red, Medium: orange, Low: green), and time estimate.
 */
const meta: Meta<typeof TodayTasksWidget> = {
  title: 'Dashboard/Widgets/TodayTasksWidget',
  component: TodayTasksWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof TodayTasksWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-neutral-200 rounded-lg"></div>
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
      <p className="text-neutral-500">Nu există sarcini pentru astăzi</p>
    </div>
  ),
};
