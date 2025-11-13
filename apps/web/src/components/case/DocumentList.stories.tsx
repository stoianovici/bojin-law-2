/**
 * DocumentList Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DocumentList } from './DocumentList';
import { createDocuments } from '@legal-platform/test-utils';

const mockDocuments = createDocuments(15);

const meta: Meta<typeof DocumentList> = {
  title: 'Case/DocumentList',
  component: DocumentList,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-6 bg-white h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DocumentList>;

/**
 * Default document list
 */
export const Default: Story = {
  args: {
    documents: mockDocuments,
    onSelectDocument: (doc) => alert(`Selected: ${doc.title}`),
    onNewDocument: () => alert('New document clicked'),
  },
};

/**
 * With selected document
 */
export const WithSelection: Story = {
  args: {
    documents: mockDocuments,
    selectedDocumentId: mockDocuments[0].id,
    onSelectDocument: (doc) => alert(`Selected: ${doc.title}`),
    onNewDocument: () => alert('New document clicked'),
  },
};

/**
 * Empty state
 */
export const Empty: Story = {
  args: {
    documents: [],
    onSelectDocument: (doc) => alert(`Selected: ${doc.title}`),
    onNewDocument: () => alert('New document clicked'),
  },
};

/**
 * Contract documents only
 */
export const ContractsOnly: Story = {
  args: {
    documents: createDocuments(8).map((d) => ({ ...d, type: 'Contract' as const })),
    onSelectDocument: (doc) => alert(`Selected: ${doc.title}`),
    onNewDocument: () => alert('New document clicked'),
  },
};

/**
 * Documents in various statuses
 */
export const MixedStatuses: Story = {
  args: {
    documents: [
      ...createDocuments(3).map((d) => ({ ...d, status: 'Draft' as const })),
      ...createDocuments(4).map((d) => ({ ...d, status: 'Review' as const })),
      ...createDocuments(3).map((d) => ({ ...d, status: 'Approved' as const })),
      ...createDocuments(2).map((d) => ({ ...d, status: 'Filed' as const })),
    ],
    onSelectDocument: (doc) => alert(`Selected: ${doc.title}`),
    onNewDocument: () => alert('New document clicked'),
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
