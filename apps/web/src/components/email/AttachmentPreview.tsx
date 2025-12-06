/**
 * Attachment Preview Component
 * Story 5.3: AI-Powered Email Drafting - Task 20
 *
 * Displays preview of suggested document attachments with:
 * - File type icon
 * - Document title and metadata
 * - Relevance score indicator
 * - Quick preview capability
 */

'use client';

import React, { useState } from 'react';
import type { AttachmentSuggestion } from '@/hooks/useEmailDraft';
import { Spinner } from '@/components/ui/spinner';

interface AttachmentPreviewProps {
  attachment: AttachmentSuggestion;
  isSelected: boolean;
  onToggle: () => void;
  onPreview?: (documentId: string) => void;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  txt: 'text',
  default: 'document',
};

function getFileTypeIcon(fileType: string): string {
  const extension = fileType.toLowerCase().split('/').pop()?.split('.').pop() || '';
  return FILE_TYPE_ICONS[extension] || FILE_TYPE_ICONS.default;
}

export function AttachmentPreview({
  attachment,
  isSelected,
  onToggle,
  onPreview,
}: AttachmentPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const iconType = getFileTypeIcon(attachment.document?.fileType || '');

  const handlePreview = async () => {
    if (onPreview) {
      setIsLoading(true);
      try {
        await onPreview(attachment.documentId);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const relevancePercentage = Math.round(attachment.relevanceScore * 100);

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            isSelected
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
          }`}
          aria-label={isSelected ? 'Remove attachment' : 'Add attachment'}
        >
          {isSelected && (
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* File icon */}
        <div className="flex-shrink-0">
          <FileTypeIcon type={iconType} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {attachment.title}
              </h4>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {attachment.document?.fileType || 'Document'}
              </p>
            </div>

            {/* Relevance score */}
            <RelevanceScore score={relevancePercentage} />
          </div>

          {/* Reason */}
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{attachment.reason}</p>

          {/* Preview button */}
          {onPreview && (
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {isLoading ? (
                <>
                  <Spinner size="xs" /> Loading...
                </>
              ) : (
                <>
                  <EyeIcon className="h-3 w-3" /> Preview
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RelevanceScore({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'
      : score >= 60
        ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'
        : 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';

  return (
    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {score}% match
    </span>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  const baseClasses = 'h-8 w-8 rounded p-1.5';

  switch (type) {
    case 'pdf':
      return (
        <div className={`${baseClasses} bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400`}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 15.5h1a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zm6 0h1a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zm-3 0h1a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5z" />
          </svg>
        </div>
      );
    case 'doc':
      return (
        <div className={`${baseClasses} bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400`}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v1H8v-1zm0 3h8v1H8v-1zm0-6h4v1H8v-1z" />
          </svg>
        </div>
      );
    case 'spreadsheet':
      return (
        <div className={`${baseClasses} bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400`}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h2v2H8v-2zm0 3h2v2H8v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2z" />
          </svg>
        </div>
      );
    case 'image':
      return (
        <div className={`${baseClasses} bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400`}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-1 14H6l4-4 2 2 4-5 4 5V5H6v10l4-4 2 2 4-5z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={`${baseClasses} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400`}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z" />
          </svg>
        </div>
      );
  }
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export default AttachmentPreview;
