import type { Meta, StoryObj } from '@storybook/react';
import { DeadlineCalendarWidget } from './DeadlineCalendarWidget';

/**
 * DeadlineCalendarWidget displays mini monthly calendar with deadline highlights.
 * Shows colored dots for deadlines, tooltips on hover with deadline details, month navigation.
 */
const meta: Meta<typeof DeadlineCalendarWidget> = {
  title: 'Dashboard/Widgets/DeadlineCalendarWidget',
  component: DeadlineCalendarWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DeadlineCalendarWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse">
      <div className="h-80 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-80 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există termene în această lună</p>
    </div>
  ),
};
