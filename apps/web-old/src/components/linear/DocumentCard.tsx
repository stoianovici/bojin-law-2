'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { FileTypeBadge } from './StatusDot';

// ====================================================================
// DocumentCard - Card for displaying documents in grid view
// ====================================================================

const documentCardVariants = cva(
  [
    'group relative overflow-hidden rounded-xl bg-linear-bg-secondary',
    'border cursor-pointer transition-all duration-200',
  ],
  {
    variants: {
      selected: {
        true: 'border-2 border-dashed border-linear-accent',
        false:
          'border border-linear-border-subtle hover:border-linear-border-default hover:shadow-md hover:-translate-y-0.5',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

// ====================================================================
// Types
// ====================================================================

export interface DocumentCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof documentCardVariants> {
  /** Document file name */
  name: string;
  /** File size (e.g., "2.1 MB") */
  size: string;
  /** File extension (e.g., "pdf", "docx") */
  fileType: string;
  /** Whether document is selected */
  selected?: boolean;
  /** Custom thumbnail content (e.g., image preview) */
  thumbnail?: React.ReactNode;
  /** Show "Open in Word" action (for .doc/.docx files) */
  showWordAction?: boolean;
  /** Callback when "Mapă" button clicked */
  onFolderClick?: (e: React.MouseEvent) => void;
  /** Callback when "Word" button clicked */
  onWordClick?: (e: React.MouseEvent) => void;
}

// ====================================================================
// Helper: Default document icon for thumbnail
// ====================================================================

function DefaultDocumentIcon() {
  return (
    <svg
      className="h-12 w-12 text-linear-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// ====================================================================
// Helper: Image icon for thumbnail
// ====================================================================

function ImageIcon() {
  return (
    <svg
      className="h-12 w-12 text-linear-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

// ====================================================================
// Helper: Spreadsheet icon for thumbnail
// ====================================================================

function SpreadsheetIcon() {
  return (
    <svg
      className="h-12 w-12 text-linear-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// ====================================================================
// DocumentCard Component
// ====================================================================

/**
 * DocumentCard renders a document with:
 * - Thumbnail preview area (4:3 aspect ratio)
 * - File type badge (top-right, colored by type)
 * - File name (truncated with ellipsis)
 * - File size
 * - Action buttons (Mapă, Word for docx files)
 * - Selected state (dashed accent border)
 */
export function DocumentCard({
  className,
  name,
  size,
  fileType,
  selected = false,
  thumbnail,
  showWordAction,
  onFolderClick,
  onWordClick,
  onClick,
  ...props
}: DocumentCardProps) {
  const normalizedType = fileType.toLowerCase().replace('.', '');
  const isDocType = normalizedType === 'doc' || normalizedType === 'docx';
  const isImageType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(normalizedType);
  const isSpreadsheetType = normalizedType === 'xls' || normalizedType === 'xlsx';

  // Determine default icon based on file type
  const DefaultIcon = isImageType
    ? ImageIcon
    : isSpreadsheetType
      ? SpreadsheetIcon
      : DefaultDocumentIcon;

  // Show Word action if explicitly set, or if file is .doc/.docx
  const displayWordAction = showWordAction ?? isDocType;

  const handleFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFolderClick?.(e);
  };

  const handleWordClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWordClick?.(e);
  };

  return (
    <div className={cn(documentCardVariants({ selected }), className)} onClick={onClick} {...props}>
      {/* Thumbnail area */}
      <div className="relative flex aspect-[4/3] items-center justify-center bg-linear-bg-tertiary">
        {thumbnail || <DefaultIcon />}

        {/* File type badge */}
        <div className="absolute right-2 top-2">
          <FileTypeBadge type={fileType} />
        </div>
      </div>

      {/* Info section */}
      <div className="border-t border-linear-border-subtle p-3">
        <div
          className="mb-1 truncate text-[13px] font-medium text-linear-text-primary"
          title={name}
        >
          {name}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-linear-text-tertiary">{size}</span>

          {/* Action buttons */}
          <div className="flex gap-1">
            <ActionButton onClick={handleFolderClick}>Mapă</ActionButton>
            {displayWordAction && <ActionButton onClick={handleWordClick}>Word</ActionButton>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// ActionButton - Small inline action button
// ====================================================================

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function ActionButton({ className, children, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md border border-linear-border-subtle bg-linear-bg-tertiary',
        'px-2 py-1 text-[11px] text-linear-text-tertiary',
        'transition-all duration-150',
        'hover:border-linear-border-default hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ====================================================================
// DocumentGrid - Grid layout for DocumentCards
// ====================================================================

export interface DocumentGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns */
  columns?: 3 | 4 | 5;
}

/**
 * DocumentGrid provides a responsive grid layout for DocumentCards.
 * Default is 5 columns on large screens, 4 on medium, 3 on small.
 */
export function DocumentGrid({ className, children, columns = 5, ...props }: DocumentGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 3 && 'grid-cols-2 md:grid-cols-3',
        columns === 4 && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        columns === 5 && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
