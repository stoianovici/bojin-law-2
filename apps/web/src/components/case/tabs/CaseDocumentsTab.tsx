'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  Folder,
  Mail,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useCaseDocuments, type CaseDocumentWithContext } from '@/hooks/useDocuments';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import { useAuth } from '@/hooks/useAuth';
import { isAssociateOrAbove } from '@/store/authStore';
import { DocumentPreviewModal } from '@/components/documents/DocumentPreviewModal';
import { fileTypeColors, formatFileSize } from '@/types/document';

// ============================================================================
// Types
// ============================================================================

interface CaseDocumentsTabProps {
  caseId: string;
  className?: string;
}

type FileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';

type DocumentCategory = 'working' | 'correspondence' | 'review';

interface CategoryConfig {
  id: DocumentCategory;
  label: string;
  icon: React.ReactNode;
  emptyMessage: string;
}

function getFileType(mimeOrExt: string): FileType {
  const lower = mimeOrExt.toLowerCase();
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('word') || lower.includes('docx') || lower.includes('doc')) return 'docx';
  if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('xls')) return 'xlsx';
  if (lower.includes('powerpoint') || lower.includes('pptx') || lower.includes('ppt'))
    return 'pptx';
  if (
    lower.includes('image') ||
    lower.includes('png') ||
    lower.includes('jpg') ||
    lower.includes('jpeg')
  )
    return 'image';
  return 'other';
}

// ============================================================================
// Sub-components
// ============================================================================

function FileTypeIcon({ fileType, className }: { fileType: FileType; className?: string }) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

function DocumentRow({
  caseDoc,
  onPreview,
  onDownload,
}: {
  caseDoc: CaseDocumentWithContext;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const doc = caseDoc.document;
  const fileType = getFileType(doc.fileType);
  const formattedDate = new Date(caseDoc.receivedAt).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-linear-bg-hover"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPreview}
    >
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-linear-bg-tertiary">
        <FileTypeIcon fileType={fileType} className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-linear-text-primary truncate block">{doc.fileName}</span>
        <span className="text-xs text-linear-text-tertiary">
          {formatFileSize(doc.fileSize)} · {formattedDate}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-1 flex-shrink-0 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Category configurations
const CATEGORIES: CategoryConfig[] = [
  {
    id: 'working',
    label: 'Documente de lucru',
    icon: <Folder className="w-4 h-4" />,
    emptyMessage: 'Nu exista documente de lucru',
  },
  {
    id: 'correspondence',
    label: 'Corespondenta',
    icon: <Mail className="w-4 h-4" />,
    emptyMessage: 'Nu exista atasamente din email',
  },
  {
    id: 'review',
    label: 'De revizuit',
    icon: <ClipboardCheck className="w-4 h-4" />,
    emptyMessage: 'Nu exista documente de revizuit',
  },
];

/**
 * Categorize a document based on its source, status, and viewer role:
 * - working: Documents created by current user, OR UPLOAD/AI_GENERATED/TEMPLATE sources for non-supervisors
 * - correspondence: EMAIL_ATTACHMENT that hasn't been promoted
 * - review: Documents pending review that current user didn't create (supervisors only)
 *
 * Role-based logic:
 * - For document author: always shows in "working" (their work in progress)
 * - For supervisors (Partner/Associate): documents they didn't create with DRAFT/READY_FOR_REVIEW status show in "review"
 */
function categorizeDocument(
  caseDoc: CaseDocumentWithContext,
  currentUserId: string | undefined,
  isSupervisor: boolean
): DocumentCategory {
  const { document, promotedFromAttachment } = caseDoc;

  // Email attachments that haven't been promoted go to correspondence (regardless of viewer)
  if (document.sourceType === 'EMAIL_ATTACHMENT' && !promotedFromAttachment) {
    return 'correspondence';
  }

  // Check if current user is the document author
  const isAuthor = currentUserId && document.uploadedBy?.id === currentUserId;

  // For supervisors viewing documents they didn't create: show in review queue
  // Documents with DRAFT or READY_FOR_REVIEW status from other team members need supervisor review
  if (
    isSupervisor &&
    !isAuthor &&
    (document.status === 'DRAFT' || document.status === 'READY_FOR_REVIEW')
  ) {
    return 'review';
  }

  // Everything else is a working document (author's own work, or non-supervisor viewing)
  return 'working';
}

export function CaseDocumentsTab({ caseId, className }: CaseDocumentsTabProps) {
  const { documents: rawDocuments, loading, error, refetch } = useCaseDocuments(caseId);
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('working');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const {
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
    openInWord,
  } = useDocumentPreview();
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    fileName: string;
    fileType: FileType;
    fileSize?: number;
  } | null>(null);

  // Determine if user is a supervisor (Partner, Associate, or BusinessOwner)
  const isSupervisor = isAssociateOrAbove(user?.dbRole);

  // Categorize documents based on user role and authorship
  const categorizedDocs = useMemo(() => {
    const result: Record<DocumentCategory, CaseDocumentWithContext[]> = {
      working: [],
      correspondence: [],
      review: [],
    };

    for (const doc of rawDocuments) {
      const category = categorizeDocument(doc, user?.id, isSupervisor);
      result[category].push(doc);
    }

    return result;
  }, [rawDocuments, user?.id, isSupervisor]);

  // Get documents for the active category
  const activeDocs = categorizedDocs[activeCategory];

  // Group documents by month
  const monthGroups = useMemo(() => {
    const groups = new Map<string, CaseDocumentWithContext[]>();
    const sorted = [...activeDocs].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    for (const caseDoc of sorted) {
      const date = new Date(caseDoc.receivedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(caseDoc);
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, docs]) => {
        const date = new Date(docs[0].receivedAt);
        const label = date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
        return { key, label: label.charAt(0).toUpperCase() + label.slice(1), documents: docs };
      });
  }, [activeDocs]);

  const handleToggleMonth = useCallback((key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDocumentPreview = useCallback(
    (caseDoc: CaseDocumentWithContext) => {
      const doc = caseDoc.document;
      setPreviewDocument({
        id: doc.id,
        fileName: doc.fileName,
        fileType: getFileType(doc.fileType),
        fileSize: doc.fileSize,
      });
      openPreview(doc.id, doc.fileType);
    },
    [openPreview]
  );

  const handleDocumentDownload = useCallback(
    async (caseDoc: CaseDocumentWithContext) => {
      const downloadUrl = await fetchDownloadUrl(caseDoc.document.id);
      if (downloadUrl) window.open(downloadUrl, '_blank');
    },
    [fetchDownloadUrl]
  );

  // Loading
  if (loading && rawDocuments.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-linear-text-secondary">Se incarca documentele...</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-sm text-linear-error mb-2">Eroare la incarcarea documentelor</p>
        <Button variant="secondary" size="sm" onClick={refetch}>
          Reincearca
        </Button>
      </div>
    );
  }

  // Empty
  if (rawDocuments.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <div className="w-16 h-16 mx-auto mb-4 bg-linear-bg-tertiary rounded-2xl flex items-center justify-center">
          <FileText className="w-8 h-8 text-linear-text-tertiary" />
        </div>
        <p className="text-base font-medium text-linear-text-secondary mb-1">Nu exista documente</p>
        <p className="text-sm text-linear-text-tertiary">
          Nu am gasit documente asociate cu acest dosar.
        </p>
      </div>
    );
  }

  // Get active category config
  const activeCategoryConfig = CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <div className={cn('', className)}>
      {/* Category tabs */}
      <div className="px-4 py-2 border-b border-linear-border-subtle flex gap-1">
        {CATEGORIES.map((category) => {
          const count = categorizedDocs[category.id].length;
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                isActive
                  ? 'bg-linear-bg-tertiary text-linear-text-primary'
                  : 'text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-hover'
              )}
            >
              {category.icon}
              <span>{category.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                    isActive
                      ? 'bg-linear-bg-secondary text-linear-text-secondary'
                      : 'bg-linear-bg-tertiary text-linear-text-tertiary'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state for active category */}
      {activeDocs.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-linear-bg-tertiary rounded-xl flex items-center justify-center text-linear-text-tertiary">
            {activeCategoryConfig.icon}
          </div>
          <p className="text-sm text-linear-text-secondary">{activeCategoryConfig.emptyMessage}</p>
        </div>
      )}

      {/* Month accordions - all collapsed by default */}
      {activeDocs.length > 0 && (
        <div className="p-4">
          {monthGroups.map((group) => {
            const isExpanded = expandedMonths.has(group.key);
            return (
              <div key={group.key} className="mb-2">
                <button
                  onClick={() => handleToggleMonth(group.key)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-linear-bg-hover rounded-lg transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-linear-text-tertiary" />
                  )}
                  <span className="text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-xs text-linear-text-tertiary">
                    ({group.documents.length})
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-2 mt-1 space-y-0.5">
                    {group.documents.map((caseDoc) => (
                      <DocumentRow
                        key={caseDoc.id}
                        caseDoc={caseDoc}
                        onPreview={() => handleDocumentPreview(caseDoc)}
                        onDownload={() => handleDocumentDownload(caseDoc)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        document={previewDocument}
        onRequestPreviewUrl={fetchPreviewUrl}
        onRequestDownloadUrl={fetchDownloadUrl}
        onRequestTextContent={fetchTextContent}
        onOpenInWord={openInWord}
      />
    </div>
  );
}
