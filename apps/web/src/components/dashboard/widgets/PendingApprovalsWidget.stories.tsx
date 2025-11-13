import type { Meta, StoryObj } from '@storybook/react';
import { PendingApprovalsWidget } from './PendingApprovalsWidget';

/**
 * PendingApprovalsWidget displays pending approval items: documents, time entries, expense reports.
 * Shows item name, requester, date submitted, and approval action buttons.
 */
const meta: Meta<typeof PendingApprovalsWidget> = {
  title: 'Dashboard/Widgets/PendingApprovalsWidget',
  component: PendingApprovalsWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof PendingApprovalsWidget>;

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
      <p className="text-neutral-500">Nu există aprobări în așteptare</p>
    </div>
  ),
};
