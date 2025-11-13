import type { Meta, StoryObj } from '@storybook/react';
import { BillableHoursChartWidget } from './BillableHoursChartWidget';

/**
 * BillableHoursChartWidget displays billable hours over time using a bar chart.
 * Shows last 6 months of billable hours by practice area with Romanian labels.
 */
const meta: Meta<typeof BillableHoursChartWidget> = {
  title: 'Dashboard/Widgets/BillableHoursChartWidget',
  component: BillableHoursChartWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof BillableHoursChartWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse">
      <div className="h-64 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-64 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există date disponibile pentru grafic</p>
    </div>
  ),
};
