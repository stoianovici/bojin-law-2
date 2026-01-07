'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Search,
  X,
  Loader2,
  FileText,
  Folder,
  Check,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { SEARCH_CASES } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

export interface UseAsTemplateModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** ID of the source document to copy */
  documentId: string;
  /** Name of the source document */
  documentName: string;
  /** Type/extension of the source document */
  documentType: string;
}

interface CaseSearchResult {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  client: {
    id: string;
    name: string;
  } | null;
}

interface SearchCasesData {
  searchCases: CaseSearchResult[];
}

interface CopyDocumentAsTemplateResult {
  copyDocumentAsTemplate: {
    success: boolean;
    newDocumentId: string | null;
    wordUrl: string | null;
    message: string | null;
  };
}

// ============================================================================
// GraphQL Mutation
// ============================================================================

const COPY_DOCUMENT_AS_TEMPLATE = gql`
  mutation CopyDocumentAsTemplate($documentId: UUID!, $targetCaseId: UUID!) {
    copyDocumentAsTemplate(documentId: $documentId, targetCaseId: $targetCaseId) {
      success
      newDocumentId
      wordUrl
      message
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

function getDocumentIcon(type: string) {
  // Map document types to appropriate colors
  const typeClass = type.toLowerCase();
  if (typeClass.includes('doc')) {
    return 'text-blue-400';
  }
  if (typeClass.includes('pdf')) {
    return 'text-red-400';
  }
  if (typeClass.includes('xls')) {
    return 'text-green-400';
  }
  return 'text-linear-text-tertiary';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// ============================================================================
// UseAsTemplateModal Component
// ============================================================================

export function UseAsTemplateModal({
  open,
  onOpenChange,
  documentId,
  documentName,
  documentType,
}: UseAsTemplateModalProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseSearchResult | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // GraphQL hooks
  const [searchCases, { data: casesData, loading: searchLoading }] = useLazyQuery<SearchCasesData>(
    SEARCH_CASES,
    {
      fetchPolicy: 'network-only',
    }
  );

  const [copyDocument, { loading: copyLoading }] =
    useMutation<CopyDocumentAsTemplateResult>(COPY_DOCUMENT_AS_TEMPLATE);

  const cases = casesData?.searchCases ?? [];

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setSearchQuery('');
        setDebouncedQuery('');
        setSelectedCase(null);
        setDropdownOpen(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      searchCases({
        variables: {
          query: debouncedQuery,
          limit: 10,
        },
      });
    }
  }, [debouncedQuery, searchCases]);

  // Update dropdown position
  useEffect(() => {
    if (dropdownOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [dropdownOpen, searchQuery]);

  // Handle case selection
  const handleSelectCase = useCallback((caseItem: CaseSearchResult) => {
    setSelectedCase(caseItem);
    setSearchQuery('');
    setDropdownOpen(false);
    inputRef.current?.blur();
  }, []);

  // Handle clear selection
  const handleClearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedCase(null);
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  // Handle copy action
  const handleCopy = useCallback(async () => {
    if (!selectedCase) return;

    try {
      const result = await copyDocument({
        variables: {
          documentId,
          targetCaseId: selectedCase.id,
        },
      });

      const response = result.data?.copyDocumentAsTemplate;

      if (response?.success && response.wordUrl) {
        // Open Word URL in new window/tab
        window.open(response.wordUrl, '_blank', 'noopener,noreferrer');

        toast.success(
          'Document copiat cu succes',
          `Documentul a fost copiat in dosarul ${selectedCase.caseNumber}`
        );

        // Close modal
        onOpenChange(false);
      } else {
        // Show error message from server or generic error
        toast.error(
          'Eroare la copiere',
          response?.message || 'Nu s-a putut copia documentul. Incercati din nou.'
        );
      }
    } catch (err) {
      console.error('Copy document error:', err);
      toast.error(
        'Eroare la copiere',
        err instanceof Error ? err.message : 'A aparut o eroare neasteptata'
      );
    }
  }, [selectedCase, documentId, copyDocument, onOpenChange]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setDropdownOpen(true);
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      setDropdownOpen(false);
    }, 200);
  }, []);

  const showDropdown = dropdownOpen && searchQuery.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Foloseste ca sablon</DialogTitle>
          <DialogDescription>
            Selecteaza dosarul in care vrei sa copiezi acest document. Campurile specifice vor fi
            actualizate automat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6">
          {/* Document Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-linear-bg-primary border border-linear-border-subtle">
            <div
              className={cn(
                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                'bg-linear-bg-tertiary'
              )}
            >
              <FileText className={cn('w-5 h-5', getDocumentIcon(documentType))} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-linear-text-primary truncate">
                {documentName}
              </p>
              <p className="text-xs text-linear-text-tertiary uppercase">{documentType}</p>
            </div>
          </div>

          {/* Case Selector */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
              Dosar destinatie <span className="text-linear-error">*</span>
            </label>
            <div ref={containerRef} className="relative">
              <div
                className={cn(
                  'relative flex h-9 w-full items-center rounded-md border bg-linear-bg-elevated px-3 text-sm transition-colors duration-150',
                  dropdownOpen && 'border-transparent outline-none ring-2 ring-linear-accent',
                  !dropdownOpen && 'border-linear-border-subtle'
                )}
              >
                <Search className="mr-2 h-4 w-4 shrink-0 text-linear-text-muted" />
                {selectedCase && !dropdownOpen ? (
                  <span
                    className="flex-1 truncate text-linear-text-primary cursor-text"
                    onClick={() => inputRef.current?.focus()}
                  >
                    {selectedCase.caseNumber} - {selectedCase.title}
                  </span>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder={
                      selectedCase
                        ? `${selectedCase.caseNumber} - ${selectedCase.title}`
                        : 'Cauta dosar...'
                    }
                    className={cn(
                      'flex-1 bg-transparent outline-none text-linear-text-primary',
                      'placeholder:text-linear-text-muted'
                    )}
                    disabled={copyLoading}
                  />
                )}
                {searchLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-linear-text-muted" />
                )}
                {selectedCase && !searchLoading && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={copyLoading}
                    className={cn(
                      'ml-2 rounded p-0.5 text-linear-text-muted transition-colors',
                      'hover:bg-linear-bg-tertiary hover:text-linear-text-primary',
                      copyLoading && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-label="Sterge selectia"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown rendered via portal to escape overflow clipping */}
              {showDropdown &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    className="fixed z-[9999] bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg overflow-hidden"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                    }}
                  >
                    {searchLoading && cases.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-linear-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Se cauta...
                      </div>
                    ) : cases.length === 0 ? (
                      <div className="py-4 text-center text-sm text-linear-text-muted">
                        <Folder className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        Niciun dosar gasit
                      </div>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {cases.map((caseItem) => (
                          <li key={caseItem.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCase(caseItem);
                              }}
                              className={cn(
                                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                                'hover:bg-linear-bg-tertiary',
                                selectedCase?.id === caseItem.id && 'bg-linear-bg-tertiary'
                              )}
                            >
                              <Folder className="h-4 w-4 shrink-0 text-linear-text-tertiary" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-linear-text-secondary">
                                    {caseItem.caseNumber}
                                  </span>
                                </div>
                                <span className="text-sm text-linear-text-primary truncate block">
                                  {caseItem.title}
                                </span>
                                {caseItem.client && (
                                  <span className="text-xs text-linear-text-tertiary truncate block">
                                    {caseItem.client.name}
                                  </span>
                                )}
                              </div>
                              {selectedCase?.id === caseItem.id && (
                                <Check className="h-4 w-4 shrink-0 text-linear-accent" />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>,
                  document.body
                )}
            </div>
          </div>

          {/* Selected case confirmation */}
          {selectedCase && (
            <div
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg',
                'bg-linear-accent/5 border border-linear-accent/20'
              )}
            >
              <Check className="w-4 h-4 text-linear-accent flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-linear-text-primary">
                  Documentul va fi copiat in dosarul:
                </p>
                <p className="text-sm font-medium text-linear-accent truncate">
                  {selectedCase.caseNumber} - {selectedCase.title}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={copyLoading}
          >
            Anuleaza
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={!selectedCase || copyLoading}
            loading={copyLoading}
          >
            {copyLoading ? (
              'Se copiaza...'
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Copiaza si deschide
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

UseAsTemplateModal.displayName = 'UseAsTemplateModal';

export default UseAsTemplateModal;
