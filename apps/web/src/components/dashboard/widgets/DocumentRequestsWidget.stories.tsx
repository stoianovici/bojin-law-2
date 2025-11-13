import type { Meta, StoryObj } from '@storybook/react';
import { DocumentRequestsWidget } from './DocumentRequestsWidget';

/**
 * DocumentRequestsWidget displays pending document requests from attorneys.
 * Shows requester name, document type needed, case context, urgency level with action buttons.
 */
const meta: Meta<typeof DocumentRequestsWidget> = {
  title: 'Dashboard/Widgets/DocumentRequestsWidget',
  component: DocumentRequestsWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DocumentRequestsWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-neutral-200 rounded-lg"></div>
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
      <p className="text-neutral-500">Nu există cereri de documente</p>
    </div>
  ),
};
