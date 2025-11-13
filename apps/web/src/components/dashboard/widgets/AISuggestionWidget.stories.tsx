import type { Meta, StoryObj } from '@storybook/react';
import { AISuggestionWidget } from './AISuggestionWidget';
import { createAISuggestionsForRole } from '@legal-platform/test-utils';

/**
 * AISuggestionWidget displays AI-generated insights, alerts, and recommendations.
 * Collapsible panel with role-specific suggestions, icons, dismiss functionality.
 */
const meta: Meta<typeof AISuggestionWidget> = {
  title: 'Dashboard/Widgets/AISuggestionWidget',
  component: AISuggestionWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof AISuggestionWidget>;

export const Default: Story = {
  args: {
    role: 'Partner',
  },
};

export const PartnerSuggestions: Story = {
  args: {
    role: 'Partner',
  },
};

export const AssociateSuggestions: Story = {
  args: {
    role: 'Associate',
  },
};

export const ParalegalSuggestions: Story = {
  args: {
    role: 'Paralegal',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-neutral-200 rounded-lg"></div>
      ))}
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-48 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există sugestii noi</p>
    </div>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <div className="border rounded-lg p-4">
      <button className="flex items-center justify-between w-full text-left">
        <span className="font-semibold">AI Insights</span>
        <span className="text-sm text-neutral-500">Extindeți pentru a vedea sugestii</span>
      </button>
    </div>
  ),
};
