/**
 * DocumentFolderTree Component Tests
 * Tests folder expand/collapse behavior and node selection
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentFolderTree } from './DocumentFolderTree';
import type { DocumentNode } from '@legal-platform/types';

describe('DocumentFolderTree', () => {
  const mockTree: DocumentNode[] = [
    {
      id: 'folder-1',
      name: 'Contracts',
      type: 'folder',
      children: [
        {
          id: 'doc-1',
          name: 'Contract 2024-001.pdf',
          type: 'file',
          documentId: 'doc-1',
        },
        {
          id: 'doc-2',
          name: 'Contract 2024-002.pdf',
          type: 'file',
          documentId: 'doc-2',
        },
      ],
    },
    {
      id: 'folder-2',
      name: 'Motions',
      type: 'folder',
      children: [
        {
          id: 'doc-3',
          name: 'Motion to Dismiss.pdf',
          type: 'file',
          documentId: 'doc-3',
        },
      ],
    },
    {
      id: 'doc-4',
      name: 'Standalone Document.pdf',
      type: 'file',
      documentId: 'doc-4',
    },
  ];

  it('should render all folder and file names', () => {
    render(<DocumentFolderTree tree={mockTree} />);
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Motions')).toBeInTheDocument();
    expect(screen.getByText('Contract 2024-001.pdf')).toBeInTheDocument();
    expect(screen.getByText('Contract 2024-002.pdf')).toBeInTheDocument();
    expect(screen.getByText('Motion to Dismiss.pdf')).toBeInTheDocument();
    expect(screen.getByText('Standalone Document.pdf')).toBeInTheDocument();
  });

  it('should render folders as expanded by default', () => {
    render(<DocumentFolderTree tree={mockTree} />);
    // Children should be visible when folders are expanded
    expect(screen.getByText('Contract 2024-001.pdf')).toBeVisible();
    expect(screen.getByText('Motion to Dismiss.pdf')).toBeVisible();
  });

  it('should collapse folder when clicked', () => {
    render(<DocumentFolderTree tree={mockTree} />);

    // Initially children are visible (expanded)
    expect(screen.getByText('Contract 2024-001.pdf')).toBeVisible();

    // Click the folder to collapse it
    const folderButton = screen.getByText('Contracts').closest('button');
    fireEvent.click(folderButton!);

    // Children should no longer be in the document (collapsed)
    expect(screen.queryByText('Contract 2024-001.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('Contract 2024-002.pdf')).not.toBeInTheDocument();
  });

  it('should expand folder when clicked twice (toggle behavior)', () => {
    render(<DocumentFolderTree tree={mockTree} />);

    const folderButton = screen.getByText('Contracts').closest('button');

    // Collapse folder
    fireEvent.click(folderButton!);
    expect(screen.queryByText('Contract 2024-001.pdf')).not.toBeInTheDocument();

    // Expand folder again
    fireEvent.click(folderButton!);
    expect(screen.getByText('Contract 2024-001.pdf')).toBeInTheDocument();
  });

  it('should call onSelectNode when folder is clicked', () => {
    const mockOnSelectNode = jest.fn();
    render(<DocumentFolderTree tree={mockTree} onSelectNode={mockOnSelectNode} />);

    const folderButton = screen.getByText('Contracts').closest('button');
    fireEvent.click(folderButton!);

    expect(mockOnSelectNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'folder-1',
        name: 'Contracts',
        type: 'folder',
      })
    );
  });

  it('should call onSelectNode when file is clicked', () => {
    const mockOnSelectNode = jest.fn();
    render(<DocumentFolderTree tree={mockTree} onSelectNode={mockOnSelectNode} />);

    const fileButton = screen.getByText('Contract 2024-001.pdf').closest('button');
    fireEvent.click(fileButton!);

    expect(mockOnSelectNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-1',
        name: 'Contract 2024-001.pdf',
        type: 'file',
        documentId: 'doc-1',
      })
    );
  });

  it('should highlight selected node', () => {
    render(<DocumentFolderTree tree={mockTree} selectedNodeId="doc-1" />);

    const selectedButton = screen.getByText('Contract 2024-001.pdf').closest('button');
    expect(selectedButton).toHaveClass('bg-blue-50');
    expect(selectedButton).toHaveClass('text-blue-700');
  });

  it('should render nested hierarchy correctly', () => {
    const nestedTree: DocumentNode[] = [
      {
        id: 'parent',
        name: 'Parent Folder',
        type: 'folder',
        children: [
          {
            id: 'child-folder',
            name: 'Child Folder',
            type: 'folder',
            children: [
              {
                id: 'grandchild-doc',
                name: 'Nested Document.pdf',
                type: 'file',
                documentId: 'grandchild-doc',
              },
            ],
          },
        ],
      },
    ];

    render(<DocumentFolderTree tree={nestedTree} />);

    expect(screen.getByText('Parent Folder')).toBeInTheDocument();
    expect(screen.getByText('Child Folder')).toBeInTheDocument();
    expect(screen.getByText('Nested Document.pdf')).toBeInTheDocument();
  });

  it('should collapse nested folders independently', () => {
    const nestedTree: DocumentNode[] = [
      {
        id: 'parent',
        name: 'Parent Folder',
        type: 'folder',
        children: [
          {
            id: 'child-folder',
            name: 'Child Folder',
            type: 'folder',
            children: [
              {
                id: 'grandchild-doc',
                name: 'Nested Document.pdf',
                type: 'file',
                documentId: 'grandchild-doc',
              },
            ],
          },
        ],
      },
    ];

    render(<DocumentFolderTree tree={nestedTree} />);

    // Collapse child folder
    const childFolderButton = screen.getByText('Child Folder').closest('button');
    fireEvent.click(childFolderButton!);

    // Child folder's contents should be hidden
    expect(screen.queryByText('Nested Document.pdf')).not.toBeInTheDocument();

    // But parent folder should still be visible
    expect(screen.getByText('Parent Folder')).toBeInTheDocument();
    expect(screen.getByText('Child Folder')).toBeInTheDocument();
  });
});
