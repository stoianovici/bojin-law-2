/**
 * DocumentPreviewModal Component
 * Full-screen modal for previewing documents and email attachments
 * Uses Office Online for Word/Excel/PPT, custom react-pdf viewer for PDFs
 */

'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  X,
  Download,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  Save,
  FolderPlus,
  FolderMinus,
  FolderInput,
  Pencil,
  Trash2,
  Link,
  RefreshCw,
  EyeOff,
  FileEdit,
  Send,
  FileCheck,
  Undo2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { PreviewContext, PreviewAction, UserRole } from '@legal-platform/types';
import { getActionsForContext, groupActions } from '@legal-platform/types';

// Lazy load PDFViewer to avoid loading react-pdf bundle until needed
const PDFViewer = lazy(() => import('./PDFViewer'));

// ============================================================================
// Types
// ============================================================================

export interface PreviewableDocument {
  id: string;
  name: string;
  contentType: string;
  size?: number;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  /** Source of preview: 'onedrive' | 'office365' | 'r2' | null */
  previewSource?: string | null;
  /** Document status for filtering review-related actions (OPS-177) */
  status?: string;
}

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PreviewableDocument | null;
  /** Optional callback to fetch preview URL on demand */
  onRequestPreviewUrl?: (documentId: string) => Promise<string | null>;
  /** Optional callback to fetch download URL for PDFs (OPS-125) */
  onRequestDownloadUrl?: (documentId: string) => Promise<string | null>;
  /** Optional callback to fetch text content for text files (OPS-109) */
  onRequestTextContent?: (documentId: string) => Promise<string | null>;
  /** Optional callback when download is clicked */
  onDownload?: (document: PreviewableDocument) => void;
  /** Whether Microsoft account is connected (for SharePoint/OneDrive access) */
  hasMsalAccount?: boolean;
  /** Callback to reconnect Microsoft account */
  onReconnectMicrosoft?: () => Promise<void>;

  // Action toolbar props (OPS-137)
  /** Context in which the preview is opened - determines default actions */
  context?: PreviewContext;
  /** Custom actions to override defaults (if not provided, uses context defaults) */
  actions?: PreviewAction[];
  /** User role for filtering role-restricted actions */
  userRole?: UserRole;
  /** Callback when an action is clicked */
  onAction?: (actionId: string, document: PreviewableDocument) => void | Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/** File types that can be previewed with Office Online */
const OFFICE_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt
];

/** File types that can be previewed natively in browser */
const BROWSER_NATIVE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/html',
];

/** Text file types that need special handling (fetch content instead of iframe) */
const TEXT_TYPES = [
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a file type can be previewed
 */
function canPreview(contentType: string): boolean {
  return OFFICE_TYPES.includes(contentType) || BROWSER_NATIVE_TYPES.includes(contentType);
}

/**
 * Get human-readable file type label
 */
function getFileTypeLabel(contentType: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'application/msword': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'image/jpeg': 'Imagine JPEG',
    'image/png': 'Imagine PNG',
    'image/gif': 'Imagine GIF',
    'image/webp': 'Imagine WebP',
    'text/plain': 'Text',
    'text/html': 'HTML',
  };
  return typeMap[contentType] || 'Fișier';
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if on mobile device
 */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

// ============================================================================
// Icon Mapping
// ============================================================================

/**
 * Map icon name strings to Lucide React components
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Download,
  Save,
  FolderPlus,
  FolderMinus,
  FolderInput,
  Pencil,
  Trash2,
  Link,
  RefreshCw,
  EyeOff,
  FileText,
  ExternalLink,
  FileEdit, // OPS-175: Promote attachment to working document
  Send, // OPS-177: Submit for review
  FileCheck, // OPS-177: Review document
  Undo2, // OPS-177: Withdraw from review
};

// ============================================================================
// ActionToolbar Component
// ============================================================================

interface ActionToolbarProps {
  actions: PreviewAction[];
  onAction: (actionId: string) => void;
  loading?: Record<string, boolean>;
}

function ActionToolbar({ actions, onAction, loading }: ActionToolbarProps) {
  const { primary, secondary } = groupActions(actions);

  if (actions.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
        {/* Primary actions - full buttons */}
        <div className="flex flex-wrap gap-2">
          {primary.map((action) => {
            const IconComponent = ICON_MAP[action.icon];
            const isLoading = loading?.[action.id];
            const isDanger = action.variant === 'danger';

            return (
              <button
                key={action.id}
                onClick={() => onAction(action.id)}
                disabled={isLoading}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isDanger
                    ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
                    : action.variant === 'primary'
                      ? 'text-white bg-blue-600 hover:bg-blue-700'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : IconComponent ? (
                  <IconComponent className="h-4 w-4" />
                ) : null}
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary actions - icon buttons with tooltips */}
        {secondary.length > 0 && (
          <div className="flex gap-1">
            {secondary.map((action) => {
              const IconComponent = ICON_MAP[action.icon];
              const isLoading = loading?.[action.id];
              const isDanger = action.variant === 'danger';

              return (
                <Tooltip.Root key={action.id}>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => onAction(action.id)}
                      disabled={isLoading}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isDanger
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                      )}
                      aria-label={action.label}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : IconComponent ? (
                        <IconComponent className="h-4 w-4" />
                      ) : null}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-md"
                      sideOffset={5}
                    >
                      {action.label}
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DocumentPreviewModal({
  isOpen,
  onClose,
  document,
  onRequestPreviewUrl,
  onRequestDownloadUrl,
  onRequestTextContent,
  onDownload,
  hasMsalAccount = true,
  onReconnectMicrosoft,
  // Action toolbar props
  context,
  actions: customActions,
  userRole,
  onAction,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const prevDocIdRef = useRef<string | null>(null);

  // Check viewport size on mount and resize
  useEffect(() => {
    const checkViewport = () => setIsMobile(isMobileViewport());
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Fetch preview URL when document changes
  useEffect(() => {
    // Early return - let render handle closed/empty state
    if (!isOpen || !document) {
      prevDocIdRef.current = null;
      return;
    }

    // Check if document changed - only reset if it did
    const docChanged = prevDocIdRef.current !== document.id;
    prevDocIdRef.current = document.id;

    // Async function to handle preview loading
    const loadPreview = async () => {
      const isTextFile = TEXT_TYPES.includes(document.contentType);
      const isPdf = document.contentType === 'application/pdf';

      // OPS-109: For text files, use dedicated text content endpoint (backend proxy)
      // This avoids CORS issues with SharePoint download URLs
      if (isTextFile && onRequestTextContent) {
        try {
          const content = await onRequestTextContent(document.id);
          if (content !== null) {
            setTextContent(content);
          } else {
            setError('Nu s-a putut încărca conținutul fișierului');
          }
        } catch {
          setError('Eroare la încărcarea conținutului');
        } finally {
          setLoading(false);
        }
        return;
      }

      // OPS-125: For PDFs, fetch download URL for react-pdf viewer
      if (isPdf && onRequestDownloadUrl) {
        try {
          const url = await onRequestDownloadUrl(document.id);
          if (url) {
            setPdfDownloadUrl(url);
          } else {
            setError('Nu s-a putut genera link-ul de descărcare PDF');
          }
        } catch {
          setError('Eroare la încărcarea PDF-ului');
        } finally {
          setLoading(false);
        }
        return;
      }

      // If document already has preview URL, use it (non-text files)
      if (document.previewUrl) {
        setPreviewUrl(document.previewUrl);
        setLoading(false);
        return;
      }

      // If no preview capability, show error
      if (!canPreview(document.contentType)) {
        setError('Acest tip de fișier nu poate fi previzualizat');
        setLoading(false);
        return;
      }

      // Try to fetch preview URL on demand
      if (onRequestPreviewUrl) {
        try {
          const url = await onRequestPreviewUrl(document.id);
          if (url) {
            setPreviewUrl(url);
          } else {
            setError('Nu s-a putut genera link-ul de previzualizare');
          }
        } catch {
          setError('Eroare la încărcarea previzualizării');
        } finally {
          setLoading(false);
        }
      } else {
        setError('Previzualizare indisponibilă');
        setLoading(false);
      }
    };

    // Only reset and reload if document changed
    if (docChanged) {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);
      setPdfDownloadUrl(null);
      setTextContent(null);
      loadPreview();
    }
  }, [isOpen, document, onRequestPreviewUrl, onRequestDownloadUrl, onRequestTextContent]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setLoading(false);
    setError('Nu s-a putut încărca previzualizarea');
  }, []);

  // Handle download click
  const handleDownload = useCallback(() => {
    if (!document) return;

    if (onDownload) {
      onDownload(document);
    } else if (document.downloadUrl) {
      window.open(document.downloadUrl, '_blank');
    }
  }, [document, onDownload]);

  // Handle open in OneDrive (mobile)
  const handleOpenInOneDrive = useCallback(() => {
    if (document?.downloadUrl) {
      window.open(document.downloadUrl, '_blank');
    }
  }, [document]);

  // ============================================================================
  // Action Toolbar Logic (OPS-137)
  // ============================================================================

  // Resolve which actions to display based on context, custom actions, and user role
  const resolvedActions = useMemo(() => {
    let actions: PreviewAction[];

    // If custom actions provided (non-empty), use those directly
    if (customActions && customActions.length > 0) {
      actions = customActions;
    } else if (context) {
      // If context provided, get defaults filtered by user role
      actions = getActionsForContext(context, userRole);
    } else {
      // No actions
      return [];
    }

    // OPS-164: Filter 'open-in-word' action to only show for Word documents
    const contentType = document?.contentType;
    const isWordDocument =
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      contentType === 'application/msword';

    actions = actions.filter((action) => {
      if (action.id === 'open-in-word') {
        return isWordDocument;
      }
      return true;
    });

    // OPS-177: Filter review-related actions based on document status
    // This ensures users only see actions valid for the document's current state
    const docStatus = document?.status;
    if (docStatus) {
      actions = actions.filter((action) => {
        switch (action.id) {
          case 'submit-for-review':
            // Only show "Submit for review" for DRAFT documents
            return docStatus === 'DRAFT';
          case 'review-document':
            // Only show "Review" for IN_REVIEW documents
            return docStatus === 'IN_REVIEW';
          case 'withdraw-from-review':
            // Only show "Withdraw" for IN_REVIEW documents
            return docStatus === 'IN_REVIEW';
          default:
            // All other actions are not status-dependent
            return true;
        }
      });
    }

    return actions;
  }, [customActions, context, userRole, document?.status, document?.contentType]);

  // Handle action clicks with loading state management
  const handleAction = useCallback(
    async (actionId: string) => {
      if (!document || !onAction) return;

      // Handle 'download' action directly without external handler
      if (actionId === 'download') {
        handleDownload();
        return;
      }

      // Set loading state for this action
      setActionLoading((prev) => ({ ...prev, [actionId]: true }));

      try {
        await onAction(actionId, document);
      } finally {
        setActionLoading((prev) => ({ ...prev, [actionId]: false }));
      }
    },
    [document, onAction, handleDownload]
  );

  if (!document) return null;

  const fileTypeLabel = getFileTypeLabel(document.contentType);
  const fileSize = formatFileSize(document.size);
  const canPreviewFile = canPreview(document.contentType);

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed inset-4 md:inset-8 bg-white rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden"
          onEscapeKeyDown={onClose}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="font-semibold text-gray-900 truncate">
                  {document.name}
                </Dialog.Title>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span>{fileTypeLabel}</span>
                  {fileSize && (
                    <>
                      <span>•</span>
                      <span>{fileSize}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Download button */}
              {document.downloadUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Descarcă</span>
                </button>
              )}

              {/* Close button */}
              <Dialog.Close asChild>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Închide"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 relative bg-gray-100 overflow-hidden">
            {/* Loading State */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 animate-fadeIn">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Se încarcă previzualizarea...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Previzualizare indisponibilă
                    </h3>
                    <p className="text-sm text-gray-600">
                      {!hasMsalAccount
                        ? 'Conectați-vă contul Microsoft pentru a previzualiza documentele din SharePoint/OneDrive.'
                        : error}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!hasMsalAccount && onReconnectMicrosoft && (
                      <button
                        onClick={onReconnectMicrosoft}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Conectare Microsoft
                      </button>
                    )}
                    {document.downloadUrl && (
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Descarcă fișierul
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile: Open in OneDrive */}
            {isMobile && canPreviewFile && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{document.name}</h3>
                    <p className="text-sm text-gray-600">
                      Pentru cea mai bună experiență, deschideți documentul în aplicația OneDrive.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenInOneDrive}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Deschide în OneDrive
                  </button>
                </div>
              </div>
            )}

            {/* Desktop: Preview - blob URLs for Office docs can't be rendered */}
            {!isMobile &&
              previewUrl &&
              !error &&
              previewUrl.startsWith('blob:') &&
              OFFICE_TYPES.includes(document.contentType) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Previzualizare indisponibilă
                      </h3>
                      <p className="text-sm text-gray-600">
                        Fișierele Office pot fi previzualizate doar dacă sunt salvate în dosar.
                        Descărcați fișierul sau salvați atașamentul în dosar pentru previzualizare.
                      </p>
                    </div>
                    {document.downloadUrl && (
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Descarcă fișierul
                      </button>
                    )}
                  </div>
                </div>
              )}

            {/* Desktop: PDF Preview using custom react-pdf viewer for 100% zoom control */}
            {!isMobile &&
              document.contentType === 'application/pdf' &&
              pdfDownloadUrl &&
              !error && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  }
                >
                  <PDFViewer
                    url={pdfDownloadUrl}
                    initialScale={1.5}
                    onLoadSuccess={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setError('Nu s-a putut încărca documentul PDF');
                    }}
                    className="h-full"
                  />
                </Suspense>
              )}

            {/* Desktop: Preview iframe for external URLs or blob URLs for non-Office/non-PDF types */}
            {!isMobile &&
              previewUrl &&
              !error &&
              document.contentType !== 'application/pdf' &&
              // Use object tag for blob URLs (images only), iframe for OneDrive/external URLs
              !(previewUrl.startsWith('blob:') && OFFICE_TYPES.includes(document.contentType)) &&
              (previewUrl.startsWith('blob:') ? (
                <object
                  data={previewUrl}
                  type={document.contentType}
                  className={clsx('w-full h-full', loading && 'invisible')}
                  title={`Previzualizare: ${document.name}`}
                  onLoad={handleIframeLoad}
                >
                  <p className="text-center text-gray-500 p-8">
                    Browserul nu poate afișa acest fișier.{' '}
                    {document.downloadUrl && (
                      <button onClick={handleDownload} className="text-blue-600 underline">
                        Descărcați-l
                      </button>
                    )}
                  </p>
                </object>
              ) : (
                <iframe
                  src={previewUrl}
                  className={clsx('w-full h-full border-0', loading && 'invisible')}
                  title={`Previzualizare: ${document.name}`}
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              ))}

            {/* Desktop: Text content display */}
            {!isMobile && textContent !== null && !error && (
              <div className="absolute inset-0 overflow-auto bg-white p-6">
                <pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                  {textContent}
                </pre>
              </div>
            )}

            {/* Cannot preview - show download option */}
            {!canPreviewFile && !error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Previzualizare nedisponibilă
                    </h3>
                    <p className="text-sm text-gray-600">
                      Acest tip de fișier ({fileTypeLabel}) nu poate fi previzualizat în browser.
                    </p>
                  </div>
                  {document.downloadUrl && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Descarcă fișierul
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar Footer (OPS-137) */}
          {resolvedActions.length > 0 && (
            <ActionToolbar
              actions={resolvedActions}
              onAction={handleAction}
              loading={actionLoading}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

DocumentPreviewModal.displayName = 'DocumentPreviewModal';

export default DocumentPreviewModal;
