/**
 * RecentDocumentsWidget - Associate Dashboard Recent Documents List
 * Displays recently modified documents with type icons and version info
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { DocumentListWidget as DocumentListWidgetType } from '@legal-platform/types';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface RecentDocumentsWidgetProps {
  widget: DocumentListWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Document Type Icon Component
 */
function DocumentTypeIcon({ type }: { type: string }) {
  const iconMap: Record<string, JSX.Element> = {
    Contract: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    Motion: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
        />
      </svg>
    ),
    Letter: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    Memo: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      </svg>
    ),
    Pleading: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    Other: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  };

  return iconMap[type] || iconMap.Other;
}

/**
 * Document List Item Component
 */
function DocumentListItem({ document }: { document: DocumentListWidgetType['documents'][0] }) {
  const [showPreview, setShowPreview] = useState(false);

  const formatDate = (date: Date) => {
    const now = new Date();
    const docDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} min în urmă`;
    }
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${hours === 1 ? 'oră' : 'ore'} în urmă`;
    }
    if (diffInMinutes < 2880) {
      return 'Ieri';
    }
    return docDate.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getPreviewText = (type: string) => {
    const previews: Record<string, string> = {
      Contract: 'Contract de prestări servicii între părți... Art. 1: Obiectul contractului...',
      Motion: 'Instanța Judecătorească, Prin prezenta, solicitam admiterea cererii...',
      Letter: 'Stimate Domnule/Doamnă, Vă scriem în legătură cu cazul...',
      Memo: 'Memoriu intern: Analiză preliminară a situației juridice...',
      Pleading: 'Către Instanța Competentă, Subsemnatul avocat depune prezenta cerere...',
      Other: 'Document legal...',
    };
    return previews[type] || previews.Other;
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root open={showPreview} onOpenChange={setShowPreview}>
        <Tooltip.Trigger asChild>
          <div
            className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
          >
            <div className="flex items-start gap-3">
              <div className="text-gray-600 mt-0.5">
                <DocumentTypeIcon type={document.type} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                  {document.title}
                </h4>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span>{document.type}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{formatDate(document.lastModified)}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span>v{document.version}</span>
                </div>
              </div>
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            className="max-w-xs bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg z-50"
            sideOffset={5}
          >
            <div className="space-y-2">
              <div className="font-semibold">{document.title}</div>
              <div className="text-gray-300">{getPreviewText(document.type)}</div>
            </div>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * RecentDocumentsWidget - Displays list of recently modified documents
 *
 * Shows document title, type, last modified date, and version number.
 * Hover shows document preview tooltip with sample text.
 */
export function RecentDocumentsWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: RecentDocumentsWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      {widget.documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">Nu există documente recente</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {(widget.documents || []).map((document) => (
            <DocumentListItem key={document.id} document={document} />
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}

RecentDocumentsWidget.displayName = 'RecentDocumentsWidget';
