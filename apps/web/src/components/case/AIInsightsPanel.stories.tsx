/**
 * AIInsightsPanel Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { AIInsightsPanel } from './AIInsightsPanel';
import { createWorkspaceAISuggestions } from '@legal-platform/test-utils';

const mockSuggestions = createWorkspaceAISuggestions(5);

const meta: Meta<typeof AIInsightsPanel> = {
  title: 'Case/AIInsightsPanel',
  component: AIInsightsPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AIInsightsPanel>;

/**
 * Panel with suggestions (expanded by default for Storybook)
 */
export const WithSuggestions: Story = {
  args: {
    caseName: 'Contract de Achiziție - Acme Corp',
    suggestions: mockSuggestions,
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Empty state - no suggestions
 */
export const EmptyState: Story = {
  args: {
    caseName: 'Litigiu Comercial - MegaCorp',
    suggestions: [],
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Document suggestions only
 */
export const DocumentSuggestions: Story = {
  args: {
    caseName: 'Contract de Muncă - ClientCo',
    suggestions: createWorkspaceAISuggestions(4).map((s) => ({
      ...s,
      type: 'document' as const,
    })),
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Deadline suggestions only
 */
export const DeadlineSuggestions: Story = {
  args: {
    caseName: 'Proces Civil - Important',
    suggestions: createWorkspaceAISuggestions(3).map((s) => ({
      ...s,
      type: 'deadline' as const,
    })),
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Task suggestions only
 */
export const TaskSuggestions: Story = {
  args: {
    caseName: 'Consultanță Juridică - StartupXYZ',
    suggestions: createWorkspaceAISuggestions(3).map((s) => ({
      ...s,
      type: 'task' as const,
    })),
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Mixed suggestion types
 */
export const MixedSuggestions: Story = {
  args: {
    caseName: 'Caz Complex - Multiaspect',
    suggestions: [
      ...createWorkspaceAISuggestions(2).map((s) => ({ ...s, type: 'document' as const })),
      ...createWorkspaceAISuggestions(2).map((s) => ({ ...s, type: 'deadline' as const })),
      ...createWorkspaceAISuggestions(2).map((s) => ({ ...s, type: 'task' as const })),
    ],
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Romanian case name with diacritics
 */
export const RomanianDiacritics: Story = {
  args: {
    caseName: 'Divorț București - Secția Civilă',
    suggestions: createWorkspaceAISuggestions(4),
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};

/**
 * Many suggestions (scrollable)
 */
export const ManySuggestions: Story = {
  args: {
    caseName: 'Litigiu Extins - Multe Aspecte',
    suggestions: createWorkspaceAISuggestions(12),
    onDismissSuggestion: (id) => alert(`Dismissed suggestion: ${id}`),
    onTakeAction: (id) => alert(`Action taken on: ${id}`),
  },
};
