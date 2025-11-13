import type { Meta, StoryObj } from '@storybook/react';
import { CaseDistributionWidget } from './CaseDistributionWidget';

/**
 * CaseDistributionWidget displays case distribution by type using a pie chart.
 * Shows percentage labels and case counts with interactive hover tooltips.
 */
const meta: Meta<typeof CaseDistributionWidget> = {
  title: 'Dashboard/Widgets/CaseDistributionWidget',
  component: CaseDistributionWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CaseDistributionWidget>;

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
      <p className="text-neutral-500">Nu există cazuri de afișat</p>
    </div>
  ),
};
