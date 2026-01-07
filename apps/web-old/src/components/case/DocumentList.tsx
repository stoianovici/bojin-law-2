/**
 * DocumentList - Document list with search, filters, and table display
 * Shows documents in a table format with version badges and status indicators
 */

'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Document, DocumentStatus, DocumentType } from '@legal-platform/types';

export interface DocumentListProps {
  documents: Document[];
  selectedDocumentId?: string;
  onSelectDocument?: (document: Document) => void;
  onNewDocument?: () => void;
  className?: string;
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: DocumentStatus }) {
  const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
    Draft: {
      label: 'Ciornă',
      className: 'bg-linear-bg-tertiary text-linear-text-primary border-linear-border-subtle',
    },
    Review: {
      label: 'În Revizuire',
      className: 'bg-linear-warning/15 text-linear-warning border-linear-warning/30',
    },
    Approved: {
      label: 'Aprobat',
      className: 'bg-linear-success/15 text-linear-success border-linear-success/30',
    },
    Filed: {
      label: 'Depus',
      className: 'bg-linear-accent/15 text-linear-accent border-linear-accent/30',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Version Badge Component
 */
function VersionBadge({ version }: { version: number }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-linear-accent/15 text-linear-accent border border-linear-accent/30">
      v{version}
    </span>
  );
}

/**
 * Document Type Label Component
 */
function DocumentTypeLabel({ type }: { type: DocumentType }) {
  const typeLabels: Record<DocumentType, string> = {
    Contract: 'Contract',
    Motion: 'Moțiune',
    Letter: 'Scrisoare',
    Memo: 'Memoriu',
    Pleading: 'Pledoarie',
    Other: 'Altele',
  };

  return <span className="text-sm text-linear-text-secondary">{typeLabels[type]}</span>;
}

/**
 * DocumentList Component
 *
 * Displays documents in a table format with search, filters, and sorting
 */
export function DocumentList({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onNewDocument,
  className,
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }
    const query = searchQuery.toLowerCase();
    return documents.filter((doc) => doc.title.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  return (
    <div className={clsx('flex flex-col h-full bg-linear-bg-secondary', className)}>
      {/* Header with search and new button */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-linear-text-primary">Listă Documente</h3>
          <button
            onClick={onNewDocument}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-linear-accent hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Document Nou
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută documente după nume..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent bg-linear-bg-secondary text-linear-text-primary"
          />
        </div>

        {/* Document Count */}
        <p className="mt-2 text-xs text-linear-text-secondary">
          Afișare {filteredDocuments.length} din {documents.length} documente
        </p>
      </div>

      {/* Document Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-linear-bg-primary border-b border-linear-border-subtle sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Nume
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Tip
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Versiune
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Modificat
              </th>
            </tr>
          </thead>
          <motion.tbody
            className="divide-y divide-linear-border-subtle"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.03 } },
            }}
          >
            {filteredDocuments.map((document) => (
              <motion.tr
                key={document.id}
                onClick={() => onSelectDocument?.(document)}
                className={clsx(
                  'cursor-pointer transition-colors',
                  selectedDocumentId === document.id
                    ? 'bg-linear-accent/10'
                    : 'hover:bg-linear-bg-hover'
                )}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-linear-accent flex-shrink-0"
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
                    <span className="font-medium text-linear-text-primary truncate">
                      {document.title}
                    </span>
                    {document.aiGenerated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-linear-accent/15 text-linear-accent">
                        AI
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <DocumentTypeLabel type={document.type} />
                </td>
                <td className="px-4 py-3">
                  <VersionBadge version={document.currentVersion} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={document.status} />
                </td>
                <td className="px-4 py-3 text-linear-text-secondary">
                  {format(document.updatedAt, 'dd MMM yyyy', { locale: ro })}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>

        {/* Empty State */}
        {filteredDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-linear-text-tertiary">
            <svg
              className="w-12 h-12 mb-3 text-linear-text-muted"
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
            <p className="text-sm font-medium">
              {searchQuery ? 'Niciun document găsit' : 'Niciun document disponibil'}
            </p>
            {searchQuery && <p className="text-xs mt-1">Încercați să căutați cu alți termeni</p>}
          </div>
        )}
      </div>
    </div>
  );
}

DocumentList.displayName = 'DocumentList';
