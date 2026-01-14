'use client';

import { useState, useMemo } from 'react';
import { FileText, Search, Check, Loader2 } from 'lucide-react';
import { useLazyQuery } from '@apollo/client/react';
import { cn } from '@/lib/utils';
import { Button, Input, Checkbox } from '@/components/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { GET_CASE_DOCUMENTS_FOR_PICKER, GET_CLIENT_DOCUMENTS_FOR_PICKER } from '@/graphql/queries';
import { formatFileSize, fileTypeColors, getFileType, type FileType } from '@/types/document';

// ============================================================================
// Types
// ============================================================================

interface DocumentForPicker {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface CaseDocumentForPicker {
  id: string;
  document: DocumentForPicker;
}

interface DocumentPickerPopoverProps {
  /** Case ID - if provided, shows "Dosar" tab */
  caseId?: string;
  /** Client ID - required for "Client" tab */
  clientId?: string;
  /** Currently selected document IDs */
  selectedDocumentIds: string[];
  /** Callback when documents are selected/deselected */
  onDocumentsChange: (documentIds: string[]) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

// ============================================================================
// File Type Icon Component
// ============================================================================

function FileTypeIcon({ fileType, className }: { fileType: FileType; className?: string }) {
  const color = fileTypeColors[fileType];
  return (
    <svg className={className} style={{ color }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentPickerPopover({
  caseId,
  clientId,
  selectedDocumentIds,
  onDocumentsChange,
  disabled = false,
}: DocumentPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'case' | 'client'>(caseId ? 'case' : 'client');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelection, setLocalSelection] = useState<string[]>(selectedDocumentIds);

  // GraphQL queries
  const [fetchCaseDocuments, { data: caseData, loading: caseLoading }] = useLazyQuery<{
    caseDocuments: CaseDocumentForPicker[];
  }>(GET_CASE_DOCUMENTS_FOR_PICKER);

  const [fetchClientDocuments, { data: clientData, loading: clientLoading }] = useLazyQuery<{
    clientDocuments: DocumentForPicker[];
  }>(GET_CLIENT_DOCUMENTS_FOR_PICKER);

  // Fetch documents when popover opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLocalSelection(selectedDocumentIds);
      setSearchQuery('');
      // Fetch based on active tab
      if (activeTab === 'case' && caseId) {
        fetchCaseDocuments({ variables: { caseId } });
      } else if (clientId) {
        fetchClientDocuments({ variables: { clientId } });
      }
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'case' | 'client') => {
    setActiveTab(tab);
    setSearchQuery('');
    if (tab === 'case' && caseId) {
      fetchCaseDocuments({ variables: { caseId } });
    } else if (tab === 'client' && clientId) {
      fetchClientDocuments({ variables: { clientId } });
    }
  };

  // Get normalized document list based on active tab
  const documents = useMemo((): DocumentForPicker[] => {
    if (activeTab === 'case' && caseData?.caseDocuments) {
      return caseData.caseDocuments.map((cd) => cd.document);
    }
    if (activeTab === 'client' && clientData?.clientDocuments) {
      return clientData.clientDocuments;
    }
    return [];
  }, [activeTab, caseData, clientData]);

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter((doc) => doc.fileName.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  // Toggle document selection
  const toggleDocument = (docId: string) => {
    setLocalSelection((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Handle add button click
  const handleAdd = () => {
    onDocumentsChange(localSelection);
    setOpen(false);
  };

  const isLoading = caseLoading || clientLoading;
  const showCaseTab = !!caseId;
  const hasSelection = localSelection.length > 0;

  // If no context available, don't render
  if (!clientId && !caseId) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <FileText className="h-4 w-4 mr-1.5" />
          Document din dosar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {/* Header */}
        <div className="px-3 py-2 border-b border-linear-border-subtle">
          <h4 className="text-sm font-medium text-linear-text-primary">Ataseaza document</h4>
        </div>

        {/* Tabs */}
        {showCaseTab && (
          <div className="flex gap-1 px-3 pt-2">
            <button
              onClick={() => handleTabChange('case')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === 'case'
                  ? 'bg-linear-accent/10 text-linear-accent'
                  : 'text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-hover'
              )}
            >
              Dosar
            </button>
            <button
              onClick={() => handleTabChange('client')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === 'client'
                  ? 'bg-linear-accent/10 text-linear-accent'
                  : 'text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-hover'
              )}
            >
              Client
            </button>
          </div>
        )}

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-linear-text-tertiary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cauta document..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Document List */}
        <ScrollArea className="max-h-[240px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-linear-text-tertiary" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-8 text-center text-xs text-linear-text-tertiary">
              {searchQuery ? 'Niciun document gasit' : 'Nu exista documente'}
            </div>
          ) : (
            <div className="px-2 pb-2">
              {filteredDocuments.map((doc) => {
                const isSelected = localSelection.includes(doc.id);
                const normalizedFileType = getFileType(doc.fileName);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDocument(doc.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors',
                      'hover:bg-linear-bg-hover',
                      isSelected && 'bg-linear-accent/5'
                    )}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <FileTypeIcon fileType={normalizedFileType} className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-linear-text-primary truncate">
                        {doc.fileName}
                      </div>
                    </div>
                    <span className="text-xs text-linear-text-tertiary flex-shrink-0">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-linear-border-subtle">
          <Button onClick={handleAdd} disabled={!hasSelection} className="w-full" size="sm">
            {hasSelection ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Adauga {localSelection.length > 1 ? `(${localSelection.length})` : ''}
              </>
            ) : (
              'Selecteaza documente'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
