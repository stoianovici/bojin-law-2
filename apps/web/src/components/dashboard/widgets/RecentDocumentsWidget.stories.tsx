import type { Meta, StoryObj } from '@storybook/react';
import { RecentDocumentsWidget } from './RecentDocumentsWidget';

/**
 * RecentDocumentsWidget displays recently modified documents with type icons.
 * Shows document title, type, last modified date, version number with hover preview tooltips.
 */
const meta: Meta<typeof RecentDocumentsWidget> = {
  title: 'Dashboard/Widgets/RecentDocumentsWidget',
  component: RecentDocumentsWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof RecentDocumentsWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-200 rounded"></div>
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
      <p className="text-neutral-500">Nu există documente recente</p>
    </div>
  ),
};
