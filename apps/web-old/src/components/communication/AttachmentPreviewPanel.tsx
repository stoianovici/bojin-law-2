/**
 * AttachmentPreviewPanel Component
 * OPS-122: Inline Attachment Preview Panel
 * OPS-140: AttachmentPreviewPanel Context Integration
 *
 * Side panel for previewing email attachments without blocking the email view.
 * Aggregates all attachments from a thread and allows quick navigation.
 * Includes action footer for saving to documents and marking as irrelevant.
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  AlertCircle,
  ExternalLink,
  GripVertical,
  Save,
  EyeOff,
  Check,
  FileEdit,
} from 'lucide-react';
import { format } from 'date-fns';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { ThreadAttachment } from '../../hooks/useThreadAttachments';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTimePeriodGroups } from '../../hooks/useTimePeriodGroups';
import { TimePeriodSection } from '../ui/TimePeriodSection';

// ============================================================================
// GraphQL Mutations (OPS-140)
// ============================================================================

const SAVE_ATTACHMENT_AS_DOCUMENT = gql`
  mutation SaveEmailAttachmentAsDocument($emailId: ID!, $attachmentId: ID!, $caseId: ID!) {
    saveEmailAttachmentAsDocument(emailId: $emailId, attachmentId: $attachmentId, caseId: $caseId) {
      document {
        id
        fileName
        fileType
        fileSize
      }
      isNew
      caseDocumentId
    }
  }
`;

const MARK_ATTACHMENT_IRRELEVANT = gql`
  mutation MarkAttachmentIrrelevant($attachmentId: ID!, $irrelevant: Boolean!) {
    markAttachmentIrrelevant(attachmentId: $attachmentId, irrelevant: $irrelevant) {
      id
      irrelevant
    }
  }
`;

// OPS-175: Promote email attachment to working document
const PROMOTE_ATTACHMENT_TO_DOCUMENT = gql`
  mutation PromoteAttachmentToDocument($input: PromoteAttachmentInput!) {
    promoteAttachmentToDocument(input: $input) {
      success
      document {
        id
        fileName
        status
      }
      error
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface AttachmentPreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAttachment: ThreadAttachment | null;
  threadAttachments: ThreadAttachment[];
  onSelectAttachment: (attachmentId: string, messageId: string) => void;
  onRequestPreviewUrl: (attachmentId: string) => Promise<string | null>;
  onDownload?: (attachment: ThreadAttachment) => void;
  /** Case ID for saving attachments - required for action buttons to work */
  caseId?: string;
  /** OPS-197: Whether the email is assigned to a case (not in NECLAR queue) */
  isEmailAssigned?: boolean;
  /** Callback when attachment is saved as document */
  onAttachmentSaved?: (attachmentId: string, documentId: string) => void;
  /** Callback when attachment is marked as irrelevant */
  onAttachmentMarkedIrrelevant?: (attachmentId: string) => void;
  /** OPS-175: Callback when attachment is promoted to working document */
  onAttachmentPromoted?: (attachmentId: string, newDocumentId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_PANEL_WIDTH = 350;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = 450;

/** File types that can be previewed with Office Online */
const OFFICE_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
];

/** File types that can be previewed natively */
const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  ...OFFICE_TYPES,
];

// ============================================================================
// Helpers
// ============================================================================

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return <FileImage className="h-4 w-4" />;
  }
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
    return <FileSpreadsheet className="h-4 w-4" />;
  }
  if (contentType.includes('word') || contentType.includes('document')) {
    return <FileText className="h-4 w-4" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(contentType: string): boolean {
  return PREVIEWABLE_TYPES.some(
    (type) => contentType === type || contentType.startsWith(type.split('/')[0] + '/')
  );
}

// ============================================================================
// Component
// ============================================================================

export function AttachmentPreviewPanel({
  isOpen,
  onClose,
  selectedAttachment,
  threadAttachments,
  onSelectAttachment,
  onRequestPreviewUrl,
  onDownload,
  caseId,
  isEmailAssigned,
  onAttachmentSaved,
  onAttachmentMarkedIrrelevant,
  onAttachmentPromoted,
}: AttachmentPreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevAttachmentIdRef = useRef<string | null>(null);

  // OPS-140: Mutation hooks and state
  const { addNotification } = useNotificationStore();
  const [savedAttachmentIds, setSavedAttachmentIds] = useState<Set<string>>(new Set());

  const [saveAttachmentMutation, { loading: savingAttachment }] = useMutation(
    SAVE_ATTACHMENT_AS_DOCUMENT,
    {
      onCompleted: (data) => {
        const result = data as {
          saveEmailAttachmentAsDocument: {
            document: { id: string; fileName: string };
            isNew: boolean;
          };
        };
        const { document, isNew } = result.saveEmailAttachmentAsDocument;
        if (selectedAttachment) {
          setSavedAttachmentIds((prev) => new Set([...prev, selectedAttachment.id]));
          onAttachmentSaved?.(selectedAttachment.id, document.id);
        }
        addNotification({
          type: 'success',
          title: isNew ? 'Atașament salvat' : 'Atașament existent',
          message: isNew
            ? `${document.fileName} a fost salvat în documente`
            : 'Acest atașament a fost salvat anterior',
        });
      },
      onError: (error: {
        message?: string;
        graphQLErrors?: Array<{ extensions?: { code?: string } }>;
      }) => {
        // OPS-197: Handle EMAIL_NOT_ASSIGNED error code with specific message
        const isNotAssigned = error.graphQLErrors?.some(
          (e) => e.extensions?.code === 'EMAIL_NOT_ASSIGNED'
        );
        addNotification({
          type: 'error',
          title: isNotAssigned ? 'Email neatribuit' : 'Eroare la salvare',
          message:
            error.message ||
            (isNotAssigned
              ? 'Emailul trebuie atribuit unui dosar înainte de a salva atașamentele.'
              : 'Nu s-a putut salva atașamentul'),
        });
      },
    }
  );

  const [markIrrelevantMutation, { loading: markingIrrelevant }] = useMutation(
    MARK_ATTACHMENT_IRRELEVANT,
    {
      onCompleted: () => {
        if (selectedAttachment) {
          onAttachmentMarkedIrrelevant?.(selectedAttachment.id);
        }
        addNotification({
          type: 'success',
          title: 'Atașament marcat',
          message: 'Atașamentul a fost marcat ca irelevant',
        });
        // Close panel after marking irrelevant
        onClose();
      },
      onError: (error) => {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: error.message || 'Nu s-a putut marca atașamentul',
        });
      },
    }
  );

  // OPS-175: Promote attachment mutation
  const [promoteAttachmentMutation, { loading: promotingAttachment }] = useMutation(
    PROMOTE_ATTACHMENT_TO_DOCUMENT
  );

  // OPS-140: Action handlers
  const handleSaveToDocuments = useCallback(async () => {
    if (!selectedAttachment || !caseId) return;

    await saveAttachmentMutation({
      variables: {
        emailId: selectedAttachment.messageId,
        attachmentId: selectedAttachment.id,
        caseId,
      },
    });
  }, [selectedAttachment, caseId, saveAttachmentMutation]);

  const handleMarkIrrelevant = useCallback(async () => {
    if (!selectedAttachment) return;

    await markIrrelevantMutation({
      variables: {
        attachmentId: selectedAttachment.id,
        irrelevant: true,
      },
    });
  }, [selectedAttachment, markIrrelevantMutation]);

  // OPS-175: Handle promote to working document
  const handlePromoteToWorking = useCallback(async () => {
    if (!selectedAttachment || !caseId) return;

    try {
      // First save to get the caseDocumentId
      const saveResult = await saveAttachmentMutation({
        variables: {
          emailId: selectedAttachment.messageId,
          attachmentId: selectedAttachment.id,
          caseId,
        },
      });

      const savedData = saveResult.data as
        | {
            saveEmailAttachmentAsDocument?: {
              document: { id: string; fileName: string };
              isNew: boolean;
              caseDocumentId: string;
            };
          }
        | undefined;

      const caseDocumentId = savedData?.saveEmailAttachmentAsDocument?.caseDocumentId;
      if (!caseDocumentId) {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut salva atașamentul pentru promovare',
        });
        return;
      }

      // Promote the saved document
      const promoteResult = await promoteAttachmentMutation({
        variables: {
          input: { caseDocumentId },
        },
      });

      const promoteData = promoteResult.data as
        | {
            promoteAttachmentToDocument?: {
              success: boolean;
              document?: { id: string; fileName: string };
              error?: string;
            };
          }
        | undefined;

      if (promoteData?.promoteAttachmentToDocument?.success) {
        const newDocId = promoteData.promoteAttachmentToDocument.document?.id;
        if (newDocId) {
          onAttachmentPromoted?.(selectedAttachment.id, newDocId);
        }
        addNotification({
          type: 'success',
          title: 'Document promovat',
          message: `${selectedAttachment.name} este acum un document de lucru editabil`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message:
            promoteData?.promoteAttachmentToDocument?.error || 'Nu s-a putut promova documentul',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut promova atașamentul la document de lucru',
      });
    }
  }, [
    selectedAttachment,
    caseId,
    saveAttachmentMutation,
    promoteAttachmentMutation,
    addNotification,
    onAttachmentPromoted,
  ]);

  // Check if current attachment is already saved
  const isAttachmentSaved = selectedAttachment
    ? savedAttachmentIds.has(selectedAttachment.id)
    : false;

  // OPS-197: Check if email is assigned to a case
  // If isEmailAssigned is undefined, fall back to checking if caseId exists
  const emailAssigned = isEmailAssigned ?? Boolean(caseId);

  // Check if we can perform document actions (need caseId AND email must be assigned)
  const canSaveToDocuments = Boolean(caseId) && emailAssigned;

  // OPS-270: Group attachments by time period for display
  const attachmentPeriods = useTimePeriodGroups(threadAttachments, (att) => att.messageDate);

  // Message for disabled state - shown when email is not assigned
  const disabledTooltip = !emailAssigned
    ? 'Atribuiți emailul unui dosar pentru a salva atașamentele'
    : undefined;

  // Load preview when attachment changes
  useEffect(() => {
    if (!isOpen || !selectedAttachment) {
      prevAttachmentIdRef.current = null;
      return;
    }

    // Only reload if attachment changed
    if (prevAttachmentIdRef.current === selectedAttachment.id) {
      return;
    }
    prevAttachmentIdRef.current = selectedAttachment.id;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);

      // Check if file type is previewable
      if (!canPreview(selectedAttachment.contentType)) {
        setError('Acest tip de fișier nu poate fi previzualizat');
        setLoading(false);
        return;
      }

      try {
        const url = await onRequestPreviewUrl(selectedAttachment.id);
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
    };

    loadPreview();
  }, [isOpen, selectedAttachment, onRequestPreviewUrl]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Navigation helpers
  const currentIndex = threadAttachments.findIndex((a) => a.id === selectedAttachment?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < threadAttachments.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prev = threadAttachments[currentIndex - 1];
      onSelectAttachment(prev.id, prev.messageId);
    }
  }, [hasPrev, currentIndex, threadAttachments, onSelectAttachment]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const next = threadAttachments[currentIndex + 1];
      onSelectAttachment(next.id, next.messageId);
    }
  }, [hasNext, currentIndex, threadAttachments, onSelectAttachment]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!selectedAttachment) return;

    if (onDownload) {
      onDownload(selectedAttachment);
    } else if (selectedAttachment.downloadUrl) {
      window.open(selectedAttachment.downloadUrl, '_blank');
    }
  }, [selectedAttachment, onDownload]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, handlePrev, handleNext, onClose]);

  if (!isOpen) return null;

  const isImage = selectedAttachment?.contentType.startsWith('image/');
  const isPdf = selectedAttachment?.contentType === 'application/pdf';
  const isOffice = OFFICE_TYPES.includes(selectedAttachment?.contentType || '');
  const isBlobUrl = previewUrl?.startsWith('blob:');

  return (
    <div
      ref={panelRef}
      className="h-full border-l bg-linear-bg-secondary flex flex-col shadow-lg"
      style={{ width: panelWidth }}
    >
      {/* Resize Handle */}
      <div
        className={clsx(
          'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group hover:bg-linear-accent/50 transition-colors z-10',
          isResizing && 'bg-linear-accent'
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-6 w-6 text-linear-text-muted" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-linear-text-primary truncate text-sm">
              {selectedAttachment?.name || 'Atașament'}
            </h3>
            {/* OPS-175: Show "Editat" badge for promoted attachments */}
            {selectedAttachment?.isPromoted && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-linear-warning bg-linear-warning/10 border border-linear-warning/30 rounded flex-shrink-0">
                <FileEdit className="h-3 w-3" />
                Editat
              </span>
            )}
          </div>
          {selectedAttachment && (
            <p className="text-xs text-linear-text-tertiary mt-0.5">
              De la {selectedAttachment.messageSender} •{' '}
              {format(selectedAttachment.messageDate, 'dd.MM.yyyy')}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-linear-text-muted hover:text-linear-text-secondary hover:bg-linear-bg-hover rounded transition-colors flex-shrink-0"
          aria-label="Închide panoul"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative overflow-hidden bg-linear-bg-tertiary">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-bg-secondary/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
              <span className="text-sm text-linear-text-secondary">Se încarcă...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-linear-warning/15 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-linear-warning" />
              </div>
              <div>
                <h4 className="font-medium text-linear-text-primary mb-1">
                  Previzualizare indisponibilă
                </h4>
                <p className="text-sm text-linear-text-secondary">{error}</p>
              </div>
              {selectedAttachment && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-lg hover:bg-linear-accent-hover transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descarcă fișierul
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preview Content */}
        {previewUrl && !error && !loading && (
          <>
            {/* Images - display directly */}
            {isImage && (
              <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
                <img
                  src={previewUrl}
                  alt={selectedAttachment?.name || 'Preview'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}

            {/* PDF - use object tag for blob, iframe for external URL */}
            {isPdf &&
              (isBlobUrl ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full"
                  title={`Previzualizare: ${selectedAttachment?.name}`}
                >
                  <p className="text-center text-linear-text-tertiary p-8">
                    Browserul nu poate afișa acest PDF.
                  </p>
                </object>
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={`Previzualizare: ${selectedAttachment?.name}`}
                  sandbox="allow-same-origin allow-scripts"
                />
              ))}

            {/* Office docs with blob URL - can't preview, show download prompt */}
            {isOffice && isBlobUrl && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                  <div className="w-14 h-14 rounded-full bg-linear-accent/15 flex items-center justify-center">
                    {getFileIcon(selectedAttachment?.contentType || '')}
                  </div>
                  <div>
                    <h4 className="font-medium text-linear-text-primary mb-1">Fișier Office</h4>
                    <p className="text-sm text-linear-text-secondary">
                      Descărcați sau deschideți în Microsoft 365 pentru vizualizare.
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-lg hover:bg-linear-accent-hover transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Descarcă
                  </button>
                </div>
              </div>
            )}

            {/* Office docs with external URL - use iframe */}
            {isOffice && !isBlobUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Previzualizare: ${selectedAttachment?.name}`}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            )}

            {/* Text/other files - use iframe */}
            {!isImage && !isPdf && !isOffice && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Previzualizare: ${selectedAttachment?.name}`}
                sandbox="allow-same-origin"
              />
            )}
          </>
        )}
      </div>

      {/* OPS-140: Action Footer - OPS-197: Always show, but disable save when email not assigned */}
      <div className="flex items-center justify-between p-3 border-t bg-linear-bg-tertiary flex-shrink-0">
        {/* Primary actions - left side */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToDocuments}
            disabled={!canSaveToDocuments || savingAttachment || isAttachmentSaved}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors',
              isAttachmentSaved
                ? 'bg-linear-success/15 text-linear-success cursor-default'
                : canSaveToDocuments
                  ? 'bg-linear-accent text-white hover:bg-linear-accent-hover disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-linear-bg-hover text-linear-text-muted cursor-not-allowed'
            )}
            title={
              disabledTooltip ||
              (isAttachmentSaved ? 'Salvat în documente' : 'Salvează în documente')
            }
          >
            {savingAttachment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAttachmentSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isAttachmentSaved ? 'Salvat' : 'Salvează'}</span>
          </button>
          {/* OPS-175: Promote to working document button - hidden if already promoted */}
          {!selectedAttachment?.isPromoted && (
            <button
              onClick={handlePromoteToWorking}
              disabled={!canSaveToDocuments || promotingAttachment || savingAttachment}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors',
                canSaveToDocuments
                  ? 'text-linear-warning bg-linear-warning/10 border border-linear-warning/30 hover:bg-linear-warning/15 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'text-linear-text-muted bg-linear-bg-tertiary border border-linear-border-subtle cursor-not-allowed'
              )}
              title={disabledTooltip || 'Editează ca document de lucru'}
            >
              {promotingAttachment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileEdit className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Editează</span>
            </button>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border rounded hover:bg-linear-bg-tertiary transition-colors"
            title="Descarcă"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descarcă</span>
          </button>
        </div>

        {/* Secondary actions - right side */}
        <div className="flex items-center gap-1">
          {previewUrl && !isBlobUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-linear-text-tertiary hover:text-linear-accent hover:bg-linear-accent/10 rounded transition-colors"
              title="Deschide în fereastră nouă"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={handleMarkIrrelevant}
            disabled={markingIrrelevant}
            className="p-2 text-linear-text-tertiary hover:text-linear-error hover:bg-linear-error/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Marchează ca irelevant"
          >
            {markingIrrelevant ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between p-3 border-t bg-linear-bg-secondary flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            disabled={!hasPrev}
            onClick={handlePrev}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-linear-text-secondary hover:bg-linear-bg-hover rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Anterior (←)"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="text-xs text-linear-text-tertiary px-2">
            {currentIndex + 1} / {threadAttachments.length}
          </span>
          <button
            disabled={!hasNext}
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-linear-text-secondary hover:bg-linear-bg-hover rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Următor (→)"
          >
            <span className="hidden sm:inline">Următor</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-linear-text-muted">← → pentru navigare</span>
      </div>

      {/* All Attachments List - OPS-270: Grouped by time period */}
      <div className="border-t bg-linear-bg-tertiary flex-shrink-0 max-h-56 overflow-y-auto">
        <div className="p-3">
          <p className="text-xs font-medium text-linear-text-tertiary mb-2">
            Atașamente în conversație ({threadAttachments.length})
          </p>
          <div className="space-y-2">
            {attachmentPeriods.map((period) => (
              <TimePeriodSection
                key={period.key}
                periodKey={period.key}
                label={period.label}
                count={period.items.length}
                defaultOpen={period.defaultOpen}
                storageKey="attachment-preview-time"
              >
                <div className="space-y-1">
                  {period.items.map((att) => (
                    <button
                      key={att.id}
                      onClick={() => onSelectAttachment(att.id, att.messageId)}
                      className={clsx(
                        'w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2 transition-colors',
                        att.id === selectedAttachment?.id
                          ? 'bg-linear-accent/15 text-linear-accent border border-linear-accent/30'
                          : 'hover:bg-linear-bg-hover text-linear-text-secondary'
                      )}
                    >
                      <span className="text-linear-text-muted flex-shrink-0">
                        {getFileIcon(att.contentType)}
                      </span>
                      <span className="truncate flex-1">{att.name}</span>
                      <span className="text-xs text-linear-text-muted flex-shrink-0">
                        {formatFileSize(att.size)}
                      </span>
                    </button>
                  ))}
                </div>
              </TimePeriodSection>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

AttachmentPreviewPanel.displayName = 'AttachmentPreviewPanel';
