import type { Meta, StoryObj } from '@storybook/react';
import { ActiveCasesWidget } from './ActiveCasesWidget';

/**
 * ActiveCasesWidget displays list of active cases with status badges and next deadline.
 * Shows case number, title, client name, status badge, and allows click navigation.
 */
const meta: Meta<typeof ActiveCasesWidget> = {
  title: 'Dashboard/Widgets/ActiveCasesWidget',
  component: ActiveCasesWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof ActiveCasesWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 bg-neutral-200 rounded-lg"></div>
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
      <p className="text-neutral-500">Nu există cazuri active</p>
    </div>
  ),
};
