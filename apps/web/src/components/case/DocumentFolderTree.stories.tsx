/**
 * DocumentFolderTree Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { DocumentFolderTree } from './DocumentFolderTree';
import { createDocumentTree } from '@legal-platform/test-utils';

const mockTree = createDocumentTree();

const meta: Meta<typeof DocumentFolderTree> = {
  title: 'Case/DocumentFolderTree',
  component: DocumentFolderTree,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-80 bg-white p-4 border border-gray-200 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DocumentFolderTree>;

/**
 * Default folder tree
 */
export const Default: Story = {
  args: {
    tree: mockTree,
    onSelectNode: (node) => alert(`Selected: ${node.name}`),
  },
};

/**
 * With selected node
 */
export const WithSelection: Story = {
  args: {
    tree: mockTree,
    selectedNodeId: mockTree.id,
    onSelectNode: (node) => alert(`Selected: ${node.name}`),
  },
};

/**
 * Complex nested tree
 */
export const ComplexNesting: Story = {
  args: {
    tree: createDocumentTree(0, 4), // Deeper tree
    onSelectNode: (node) => alert(`Selected: ${node.name}`),
  },
};

/**
 * Shallow tree (2 levels)
 */
export const ShallowTree: Story = {
  args: {
    tree: createDocumentTree(0, 2),
    onSelectNode: (node) => alert(`Selected: ${node.name}`),
  },
};
