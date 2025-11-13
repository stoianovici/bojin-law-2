/**
 * DocumentPreview Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DocumentPreview } from './DocumentPreview';
import { createDocument, createDocumentVersions } from '@legal-platform/test-utils';

const mockDocument = createDocument({ type: 'Contract' });
const mockVersions = createDocumentVersions(5, mockDocument.id);

const meta: Meta<typeof DocumentPreview> = {
  title: 'Case/DocumentPreview',
  component: DocumentPreview,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DocumentPreview>;

/**
 * Default document preview
 */
export const Default: Story = {
  args: {
    document: { ...mockDocument, versions: mockVersions },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};

/**
 * Contract document
 */
export const ContractDocument: Story = {
  args: {
    document: {
      ...createDocument({ type: 'Contract', title: 'Contract de Prestări Servicii' }),
      versions: mockVersions,
    },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};

/**
 * Motion document
 */
export const MotionDocument: Story = {
  args: {
    document: {
      ...createDocument({ type: 'Motion', title: 'Cerere de Amânare' }),
      versions: createDocumentVersions(3, mockDocument.id),
    },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};

/**
 * Document without versions
 */
export const NoVersions: Story = {
  args: {
    document: { ...mockDocument, versions: [] },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};

/**
 * AI-generated document
 */
export const AIGenerated: Story = {
  args: {
    document: {
      ...createDocument({ aiGenerated: true, title: 'Scrisoare Generată AI' }),
      versions: mockVersions,
    },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};

/**
 * Document in review status
 */
export const ReviewStatus: Story = {
  args: {
    document: {
      ...createDocument({ status: 'Review', title: 'Document în Revizuire' }),
      versions: mockVersions,
    },
    onOpen: () => alert('Open document'),
    onDownload: () => alert('Download document'),
    onViewHistory: () => alert('View history'),
  },
};
