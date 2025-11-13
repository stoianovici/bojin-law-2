/**
 * DocumentsTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DocumentsTab } from './DocumentsTab';
import { createDocuments, createDocumentTree } from '@legal-platform/test-utils';

const mockDocuments = createDocuments(15);
const mockTree = createDocumentTree();

const meta: Meta<typeof DocumentsTab> = {
  title: 'Case/Tabs/DocumentsTab',
  component: DocumentsTab,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DocumentsTab>;

/**
 * Default documents tab with three-column layout
 */
export const Default: Story = {
  args: {
    documents: mockDocuments,
    folderTree: mockTree,
    onSelectDocument: (doc) => console.log('Selected document:', doc.title),
    onNewDocument: () => alert('New document'),
  },
};

/**
 * With selected document
 */
export const WithSelectedDocument: Story = {
  args: {
    documents: mockDocuments,
    folderTree: mockTree,
    selectedDocumentId: mockDocuments[0].id,
    onSelectDocument: (doc) => console.log('Selected document:', doc.title),
    onNewDocument: () => alert('New document'),
  },
};

/**
 * Few documents
 */
export const FewDocuments: Story = {
  args: {
    documents: createDocuments(3),
    folderTree: mockTree,
    onSelectDocument: (doc) => console.log('Selected document:', doc.title),
    onNewDocument: () => alert('New document'),
  },
};

/**
 * Many documents (scrollable)
 */
export const ManyDocuments: Story = {
  args: {
    documents: createDocuments(30),
    folderTree: mockTree,
    onSelectDocument: (doc) => console.log('Selected document:', doc.title),
    onNewDocument: () => alert('New document'),
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
