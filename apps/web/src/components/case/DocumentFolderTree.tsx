/**
 * DocumentFolderTree - Hierarchical folder tree navigation for documents
 * Displays folder structure with expand/collapse functionality
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import type { DocumentNode } from '@legal-platform/types';

export interface DocumentFolderTreeProps {
  tree: DocumentNode[];
  selectedNodeId?: string;
  onSelectNode?: (node: DocumentNode) => void;
  className?: string;
}

/**
 * TreeNode Component - Recursive component for rendering tree nodes
 */
interface TreeNodeProps {
  node: DocumentNode;
  level: number;
  selectedNodeId?: string;
  onSelectNode?: (node: DocumentNode) => void;
}

function TreeNode({ node, level, selectedNodeId, onSelectNode }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedNodeId;

  const handleClick = () => {
    if (node.type === 'folder' && hasChildren) {
      setIsExpanded(!isExpanded);
    }
    onSelectNode?.(node);
  };

  const FolderIcon = isExpanded ? FolderOpenIcon : FolderClosedIcon;
  const Icon = node.type === 'folder' ? FolderIcon : FileIcon;

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors text-left',
          isSelected
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100',
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <Icon className="flex-shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.type === 'folder' && hasChildren && (
          <ChevronIcon
            className={clsx(
              'ml-auto flex-shrink-0 transition-transform',
              isExpanded && 'rotate-90',
            )}
          />
        )}
      </button>

      {/* Render children if expanded */}
      {node.type === 'folder' && hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Icon Components
 */
function FolderClosedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('w-4 h-4 text-yellow-600', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('w-4 h-4 text-yellow-600', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('w-4 h-4 text-blue-600', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('w-4 h-4 text-gray-500', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

/**
 * DocumentFolderTree Component
 *
 * Displays a hierarchical tree of folders and documents with expand/collapse functionality
 */
export function DocumentFolderTree({
  tree,
  selectedNodeId,
  onSelectNode,
  className,
}: DocumentFolderTreeProps) {
  return (
    <div className={clsx('flex flex-col h-full', className)}>
      <div className="px-2 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Documente</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>
    </div>
  );
}

DocumentFolderTree.displayName = 'DocumentFolderTree';
