'use client';

import { useMemo, useCallback } from 'react';
import {
  Search,
  Grid,
  List,
  Upload,
  Filter,
  ChevronDown,
  ChevronRight,
  FilePlus,
} from 'lucide-react';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ScrollArea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useDocumentsStore } from '@/store/documentsStore';
import { useAuth } from '@/hooks/useAuth';
import { isAssociateOrAbove } from '@/store/authStore';
import type { Document } from '@/types/document';
import { DocumentCard } from './DocumentCard';
import { DocumentListItem } from './DocumentListItem';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';

interface DocumentsContentPanelProps {
  documents: Document[];
  breadcrumb?: { label: string; onClick?: () => void }[];
  reviewCount?: number;
  onUpload?: () => void;
  onCreateDocument?: () => void;
  onPreviewDocument?: (doc: Document) => void;
  onOpenInWord?: (doc: Document) => void;
  onDownloadDocument?: (doc: Document) => void;
  onDeleteDocument?: (doc: Document) => void;
  onRenameDocument?: (doc: Document) => void;
  onAssignToMapa?: (doc: Document) => void;
  onPrivacyChange?: () => void;
  /** Mark DRAFT document as ready for review (author only) */
  onMarkReadyForReview?: (doc: Document) => void;
  /** Mark READY_FOR_REVIEW document as final (supervisor only) */
  onMarkFinal?: (doc: Document) => void;
}

// Group documents by time period
function groupDocumentsByPeriod(documents: Document[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: { label: string; docs: Document[] }[] = [
    { label: 'Azi', docs: [] },
    { label: 'Săptămâna aceasta', docs: [] },
    { label: 'Luna aceasta', docs: [] },
    { label: 'Mai vechi', docs: [] },
  ];

  documents.forEach((doc) => {
    const docDate = new Date(doc.uploadedAt);
    if (docDate >= today) {
      groups[0].docs.push(doc);
    } else if (docDate >= weekAgo) {
      groups[1].docs.push(doc);
    } else if (docDate >= monthStart) {
      groups[2].docs.push(doc);
    } else {
      groups[3].docs.push(doc);
    }
  });

  // Filter out empty groups
  return groups.filter((g) => g.docs.length > 0);
}

export function DocumentsContentPanel({
  documents,
  breadcrumb = [],
  reviewCount = 0,
  onUpload,
  onCreateDocument,
  onPreviewDocument,
  onOpenInWord,
  onDownloadDocument,
  onDeleteDocument,
  onRenameDocument,
  onAssignToMapa,
  onPrivacyChange,
  onMarkReadyForReview,
  onMarkFinal,
}: DocumentsContentPanelProps) {
  const {
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    selectedDocumentIds,
    toggleDocumentSelection,
    previewDocumentId,
    setPreviewDocument,
  } = useDocumentsStore();

  // Get current user for role-based filtering
  const { user } = useAuth();
  const isSupervisor = isAssociateOrAbove(user?.dbRole);

  // Preview hook for fetching URLs
  const { fetchPreviewUrl, fetchDownloadUrl, fetchTextContent } = useDocumentPreview();

  // Find the document being previewed
  const previewDocument = useMemo(() => {
    if (!previewDocumentId) return null;
    return documents.find((d) => d.id === previewDocumentId) || null;
  }, [previewDocumentId, documents]);

  // Handle preview request
  const handlePreviewDocument = useCallback(
    (doc: Document) => {
      setPreviewDocument(doc.id);
      onPreviewDocument?.(doc);
    },
    [setPreviewDocument, onPreviewDocument]
  );

  // Handle close preview
  const handleClosePreview = useCallback(() => {
    setPreviewDocument(null);
  }, [setPreviewDocument]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Tab filter - filter by document category with role-based logic
    switch (activeTab) {
      case 'working':
        // Working documents for this user:
        // - All non-email-attachment documents the user created
        // - For non-supervisors: all non-email-attachment documents
        // - For supervisors: only their own documents (others go to review)
        filtered = filtered.filter((d) => {
          if (d.sourceType === 'EMAIL_ATTACHMENT') return false;
          // For supervisors, only show their own documents in "working"
          // Documents from others with DRAFT/READY_FOR_REVIEW go to "review"
          if (isSupervisor && d.uploadedBy?.id !== user?.id) {
            if (d.status === 'DRAFT' || d.status === 'READY_FOR_REVIEW') {
              return false; // These go to review tab
            }
          }
          return true;
        });
        break;
      case 'correspondence':
        // Correspondence: only email attachments
        filtered = filtered.filter((d) => d.sourceType === 'EMAIL_ATTACHMENT');
        break;
      case 'review':
        // Review queue: documents pending review from OTHER team members
        // - Only for supervisors (Partner/Associate/BusinessOwner)
        // - Excludes user's own documents
        // - Excludes email attachments (they stay in correspondence tab)
        // - Includes DRAFT and READY_FOR_REVIEW status
        filtered = filtered.filter((d) => {
          if (!isSupervisor) return false; // Non-supervisors see nothing here
          if (d.uploadedBy?.id === user?.id) return false; // Exclude own documents
          if (d.sourceType === 'EMAIL_ATTACHMENT') return false; // Exclude email attachments
          return d.status === 'DRAFT' || d.status === 'READY_FOR_REVIEW';
        });
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.fileName.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((d) => d.fileType === typeFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return filtered;
  }, [documents, activeTab, searchQuery, statusFilter, typeFilter, isSupervisor, user?.id]);

  const groupedDocuments = groupDocumentsByPeriod(filteredDocuments);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-linear-bg-primary">
      {/* Header */}
      <header className="px-6 py-4 border-b border-linear-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-linear-text-muted" />}
                <span
                  className={cn(
                    i === breadcrumb.length - 1
                      ? 'text-linear-text-primary'
                      : 'text-linear-text-tertiary cursor-pointer hover:text-linear-text-secondary'
                  )}
                  onClick={item.onClick}
                >
                  {item.label}
                </span>
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-linear-text-muted" />
            <Input
              placeholder="Căutați documente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          {/* View Toggle */}
          <div className="flex items-center rounded-lg p-1 bg-linear-bg-secondary">
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-linear-bg-elevated text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-linear-bg-elevated text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* Create Document Button */}
          <Button variant="secondary" onClick={onCreateDocument} data-tutorial="btn-document-nou">
            <FilePlus className="w-4 h-4 mr-2" />
            Document nou
          </Button>
          {/* Upload Button */}
          <Button onClick={onUpload}>
            <Upload className="w-4 h-4 mr-2" />
            Încarcă
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 border-b border-linear-border-subtle">
        <div className="flex items-center gap-6">
          <button
            className={cn(
              'py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'working'
                ? 'text-linear-text-primary border-linear-accent'
                : 'text-linear-text-tertiary border-transparent hover:text-linear-text-secondary'
            )}
            onClick={() => setActiveTab('working')}
          >
            Documente de lucru
          </button>
          <button
            className={cn(
              'py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'correspondence'
                ? 'text-linear-text-primary border-linear-accent'
                : 'text-linear-text-tertiary border-transparent hover:text-linear-text-secondary'
            )}
            onClick={() => setActiveTab('correspondence')}
          >
            Corespondență
          </button>
          <button
            className={cn(
              'py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === 'review'
                ? 'text-linear-text-primary border-linear-accent'
                : 'text-linear-text-tertiary border-transparent hover:text-linear-text-secondary'
            )}
            onClick={() => setActiveTab('review')}
          >
            De revizuit
            {reviewCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-linear-warning text-white">
                {reviewCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-linear-border-subtle flex items-center gap-3">
        <Button variant="secondary" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filtrează
        </Button>

        {/* Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="bg-linear-bg-secondary">
              Tip: {typeFilter === 'all' ? 'Toate' : typeFilter.toUpperCase()}
              <ChevronDown className="w-3 h-3 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setTypeFilter('all')}>Toate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('pdf')}>PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('docx')}>DOCX</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('xlsx')}>XLSX</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('image')}>Imagini</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="bg-linear-bg-secondary">
              Stare: {statusFilter === 'all' ? 'Toate' : statusFilter}
              <ChevronDown className="w-3 h-3 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>Toate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('DRAFT')}>Ciornă</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('READY_FOR_REVIEW')}>
              De revizuit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('FINAL')}>Final</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <span className="text-sm text-linear-text-tertiary">
          {filteredDocuments.length} documente
        </span>
      </div>

      {/* Document Grid/List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {groupedDocuments.length === 0 ? (
            <div className="text-center py-12 text-linear-text-tertiary">Niciun document găsit</div>
          ) : (
            groupedDocuments.map((group) => (
              <div key={group.label} className="mb-8">
                <h3 className="text-xs font-medium uppercase tracking-wider text-linear-text-muted mb-4">
                  {group.label}
                </h3>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.docs.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        isSelected={selectedDocumentIds.includes(doc.id)}
                        onSelect={() => toggleDocumentSelection(doc.id)}
                        onClick={() => handlePreviewDocument(doc)}
                        onPreview={() => handlePreviewDocument(doc)}
                        onOpenInWord={() => onOpenInWord?.(doc)}
                        onDownload={() => onDownloadDocument?.(doc)}
                        onRename={() => onRenameDocument?.(doc)}
                        onDelete={() => onDeleteDocument?.(doc)}
                        onAssignToMapa={() => onAssignToMapa?.(doc)}
                        onPrivacyChange={onPrivacyChange}
                        onMarkReadyForReview={
                          onMarkReadyForReview ? () => onMarkReadyForReview(doc) : undefined
                        }
                        onMarkFinal={onMarkFinal ? () => onMarkFinal(doc) : undefined}
                        isSupervisor={isSupervisor}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {group.docs.map((doc) => (
                      <DocumentListItem
                        key={doc.id}
                        document={doc}
                        isSelected={selectedDocumentIds.includes(doc.id)}
                        onSelect={() => toggleDocumentSelection(doc.id)}
                        onClick={() => handlePreviewDocument(doc)}
                        onPreview={() => handlePreviewDocument(doc)}
                        onOpenInWord={() => onOpenInWord?.(doc)}
                        onDownload={() => onDownloadDocument?.(doc)}
                        onRename={() => onRenameDocument?.(doc)}
                        onDelete={() => onDeleteDocument?.(doc)}
                        onAssignToMapa={() => onAssignToMapa?.(doc)}
                        onPrivacyChange={onPrivacyChange}
                        onMarkReadyForReview={
                          onMarkReadyForReview ? () => onMarkReadyForReview(doc) : undefined
                        }
                        onMarkFinal={onMarkFinal ? () => onMarkFinal(doc) : undefined}
                        isSupervisor={isSupervisor}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={handleClosePreview}
        document={previewDocument}
        onRequestPreviewUrl={fetchPreviewUrl}
        onRequestDownloadUrl={fetchDownloadUrl}
        onRequestTextContent={fetchTextContent}
        onDownload={onDownloadDocument ? (doc) => onDownloadDocument(doc as Document) : undefined}
      />
    </div>
  );
}
