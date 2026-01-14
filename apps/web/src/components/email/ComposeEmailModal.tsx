'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  X,
  Paperclip,
  Folder,
  Sparkles,
  Send,
  Loader2,
  Search,
  Check,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input } from '@/components/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { useQuery } from '@/hooks/useGraphQL';
import { useLazyQuery } from '@apollo/client/react';
import { GET_CASES, GET_CASE_DOCUMENTS_FOR_PICKER } from '@/graphql/queries';
import { DocumentPickerPopover } from './DocumentPickerPopover';

// Draft storage key
const DRAFT_STORAGE_KEY = 'compose-email-draft';

// Types for cases
interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  referenceNumbers?: string[];
  client: {
    id: string;
    name: string;
  };
}

interface GetCasesResponse {
  cases: CaseItem[];
}

interface SavedDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  caseId?: string;
  caseName?: string;
  savedAt: string;
}

// Selected document type
interface SelectedDocument {
  id: string;
  fileName: string;
  fileSize: number;
}

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    attachments?: File[];
    caseId?: string;
    documentIds?: string[];
  }) => Promise<void>;
  onGenerateAi: (prompt: string) => Promise<string | null>;
  // Pre-fill values (for replies)
  defaultTo?: string;
  defaultSubject?: string;
  replyToThreadId?: string;
}

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSend,
  onGenerateAi,
  defaultTo = '',
  defaultSubject = '',
  replyToThreadId,
}: ComposeEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [caseId, setCaseId] = useState<string | undefined>();
  const [caseName, setCaseName] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();

  // Platform document attachments
  const [selectedDocuments, setSelectedDocuments] = useState<SelectedDocument[]>([]);

  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // Case picker state
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');

  // Fetch case documents when a case is selected (for document picker)
  const [fetchCaseDocuments, { data: caseDocumentsData }] = useLazyQuery<{
    caseDocuments: Array<{
      id: string;
      document: { id: string; fileName: string; fileSize: number };
    }>;
  }>(GET_CASE_DOCUMENTS_FOR_PICKER);

  // Fetch cases for the picker
  const { data: casesData, loading: casesLoading } = useQuery<GetCasesResponse>(GET_CASES);
  const cases = casesData?.cases || [];

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!caseSearchQuery.trim()) return cases;
    const query = caseSearchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.client.name.toLowerCase().includes(query)
    );
  }, [cases, caseSearchQuery]);

  // Load draft from localStorage when modal opens
  useEffect(() => {
    if (isOpen && !defaultTo && !defaultSubject) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          const draft: SavedDraft = JSON.parse(savedDraft);
          setTo(draft.to || '');
          setCc(draft.cc || '');
          setSubject(draft.subject || '');
          setBody(draft.body || '');
          setCaseId(draft.caseId);
          setCaseName(draft.caseName);
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }, [isOpen, defaultTo, defaultSubject]);

  // Reset form when modal opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      } else {
        // Reset to defaults
        setTo(defaultTo);
        setCc('');
        setSubject(defaultSubject);
        setBody('');
        setAiPrompt('');
        setAttachments([]);
        setCaseId(undefined);
        setCaseName(undefined);
        setClientId(undefined);
        setSelectedDocuments([]);
        setCaseSearchQuery('');
        setDraftSaved(false);
      }
    },
    [onClose, defaultTo, defaultSubject]
  );

  // Handle case selection
  const handleSelectCase = useCallback(
    (selectedCase: CaseItem) => {
      setCaseId(selectedCase.id);
      setClientId(selectedCase.client.id);
      const displayNumber = selectedCase.referenceNumbers?.[0];
      setCaseName(displayNumber ? `${displayNumber} - ${selectedCase.title}` : selectedCase.title);
      setCasePickerOpen(false);
      setCaseSearchQuery('');
      setDraftSaved(false);
      // Clear previously selected documents when changing case
      setSelectedDocuments([]);
      // Fetch documents for the new case
      fetchCaseDocuments({ variables: { caseId: selectedCase.id } });
    },
    [fetchCaseDocuments]
  );

  // Handle case removal
  const handleRemoveCase = useCallback(() => {
    setCaseId(undefined);
    setCaseName(undefined);
    setClientId(undefined);
    setSelectedDocuments([]);
    setDraftSaved(false);
  }, []);

  // Save draft to localStorage
  const handleSaveDraft = useCallback(() => {
    // Don't save if there's nothing to save
    if (!to.trim() && !subject.trim() && !body.trim()) {
      return;
    }

    setSavingDraft(true);
    try {
      const draft: SavedDraft = {
        to: to.trim(),
        cc: cc.trim(),
        subject: subject.trim(),
        body: body.trim(),
        caseId,
        caseName,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftSaved(true);
      // Reset saved indicator after 2 seconds
      setTimeout(() => setDraftSaved(false), 2000);
    } finally {
      setSavingDraft(false);
    }
  }, [to, cc, subject, body, caseId, caseName]);

  // Clear draft from localStorage after successful send
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  // Handle AI generation
  const handleGenerateAi = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setGenerating(true);
    try {
      const result = await onGenerateAi(aiPrompt.trim());
      if (result) {
        setBody(result);
        setAiPrompt('');
      }
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, onGenerateAi]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setSending(true);
    try {
      const documentIds =
        selectedDocuments.length > 0 ? selectedDocuments.map((d) => d.id) : undefined;

      await onSend({
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
        caseId,
        documentIds,
      });
      // Clear draft from localStorage on successful send
      clearDraft();
      // Close modal on success
      onClose();
    } finally {
      setSending(false);
    }
  }, [to, cc, subject, body, attachments, caseId, selectedDocuments, onSend, onClose, clearDraft]);

  // Handle document selection change from picker
  const handleDocumentsChange = useCallback(
    (documentIds: string[]) => {
      // Build SelectedDocument[] from documentIds using case documents data
      if (!caseDocumentsData?.caseDocuments) {
        setSelectedDocuments([]);
        return;
      }

      const selected = documentIds
        .map((id) => {
          const caseDoc = caseDocumentsData.caseDocuments.find(
            (cd: { document: { id: string } }) => cd.document.id === id
          );
          if (!caseDoc) return null;
          return {
            id: caseDoc.document.id,
            fileName: caseDoc.document.fileName,
            fileSize: caseDoc.document.fileSize,
          };
        })
        .filter((d): d is SelectedDocument => d !== null);

      setSelectedDocuments(selected);
      setDraftSaved(false);
    },
    [caseDocumentsData]
  );

  // Remove a platform document attachment
  const removeSelectedDocument = useCallback((docId: string) => {
    setSelectedDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  // Handle file attachment
  const handleAttach = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileArray = Array.from(files);
        // Validate file size (3MB max each)
        const validFiles = fileArray.filter((f) => f.size <= 3 * 1024 * 1024);
        // Limit to 10 files total
        const newAttachments = [...attachments, ...validFiles].slice(0, 10);
        setAttachments(newAttachments);
      }
    };
    input.click();
  }, [attachments]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isLoading = sending || generating;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{replyToThreadId ? 'Răspunde' : 'Email nou'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To Field */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1.5 block">Către</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@exemplu.ro"
              disabled={isLoading}
            />
          </div>

          {/* CC Field */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1.5 block">CC</label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Opțional"
              disabled={isLoading}
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1.5 block">Subiect</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subiectul emailului"
              disabled={isLoading}
            />
          </div>

          {/* AI Generation Section */}
          <div
            className={cn(
              'p-3 rounded-lg',
              'bg-gradient-to-r from-linear-accent/5 to-purple-500/5',
              'border border-linear-accent/20'
            )}
          >
            <label className="flex items-center gap-1.5 text-xs text-linear-accent font-medium mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Generare AI
            </label>
            <div className="flex gap-2">
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiPrompt.trim()) {
                    e.preventDefault();
                    handleGenerateAi();
                  }
                }}
                placeholder="Descrie ce vrei să trimiți (ex: email formal de confirmare a întâlnirii)..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={handleGenerateAi} disabled={isLoading || !aiPrompt.trim()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generează'}
              </Button>
            </div>
          </div>

          {/* Body Field */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1.5 block">Mesaj</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Scrie mesajul aici sau folosește AI pentru generare..."
              disabled={isLoading}
              className={cn(
                'w-full min-h-[150px] p-3',
                'bg-linear-bg-tertiary border border-linear-border-subtle rounded-lg',
                'text-sm text-linear-text-primary placeholder:text-linear-text-tertiary',
                'resize-y outline-none',
                'focus:border-linear-accent/50',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>

          {/* Selected Case Badge */}
          {caseId && caseName && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-linear-accent/10 border border-linear-accent/30 rounded-lg text-xs">
                <Folder className="h-3.5 w-3.5 text-linear-accent" />
                <span className="text-linear-accent font-medium max-w-[200px] truncate">
                  {caseName}
                </span>
                <button
                  onClick={handleRemoveCase}
                  disabled={isLoading}
                  className="ml-1 text-linear-accent/70 hover:text-linear-accent transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Attachments List (local files) */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-2 py-1 bg-linear-bg-tertiary border border-linear-border-subtle rounded text-xs"
                >
                  <Paperclip className="h-3 w-3 text-linear-text-tertiary" />
                  <span className="text-linear-text-secondary max-w-[150px] truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 text-linear-text-tertiary hover:text-linear-error"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Platform Document Attachments */}
          {selectedDocuments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-linear-accent/5 border border-linear-accent/30 rounded text-xs"
                >
                  <FileText className="h-3 w-3 text-linear-accent" />
                  <span className="text-linear-text-secondary max-w-[150px] truncate">
                    {doc.fileName}
                  </span>
                  <button
                    onClick={() => removeSelectedDocument(doc.id)}
                    className="ml-1 text-linear-accent/70 hover:text-linear-error"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-linear-border-subtle">
          <div className="flex items-center gap-2">
            {/* Attach Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAttach}
              disabled={isLoading || attachments.length >= 10}
            >
              <Paperclip className="h-4 w-4 mr-1.5" />
              Atașează
            </Button>

            {/* Link to Case Button with Popover */}
            <Popover open={casePickerOpen} onOpenChange={setCasePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  className={cn(caseId && 'text-linear-accent hover:text-linear-accent')}
                >
                  <Folder className="h-4 w-4 mr-1.5" />
                  {caseId ? 'Schimbă dosarul' : 'Asociază cu dosar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-0">
                {/* Search Input */}
                <div className="p-3 border-b border-linear-border-subtle">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-linear-text-tertiary" />
                    <Input
                      value={caseSearchQuery}
                      onChange={(e) => setCaseSearchQuery(e.target.value)}
                      placeholder="Caută dosar..."
                      className="pl-8 h-8 text-xs"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Cases List */}
                <ScrollArea className="max-h-[240px]">
                  {casesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-linear-text-tertiary" />
                    </div>
                  ) : filteredCases.length === 0 ? (
                    <div className="py-6 text-center text-xs text-linear-text-tertiary">
                      {caseSearchQuery ? 'Niciun dosar găsit' : 'Nu există dosare'}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredCases.map((caseItem) => (
                        <button
                          key={caseItem.id}
                          onClick={() => handleSelectCase(caseItem)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors',
                            'hover:bg-linear-bg-hover',
                            caseId === caseItem.id && 'bg-linear-accent/10'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {caseItem.referenceNumbers?.[0] && (
                                <span className="text-xs font-medium text-linear-text-secondary">
                                  {caseItem.referenceNumbers[0]}
                                </span>
                              )}
                              {caseId === caseItem.id && (
                                <Check className="h-3 w-3 text-linear-accent" />
                              )}
                            </div>
                            <div className="text-sm text-linear-text-primary truncate">
                              {caseItem.title}
                            </div>
                            <div className="text-xs text-linear-text-tertiary truncate">
                              {caseItem.client.name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Clear Selection */}
                {caseId && (
                  <div className="p-2 border-t border-linear-border-subtle">
                    <button
                      onClick={() => {
                        handleRemoveCase();
                        setCasePickerOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors rounded-md hover:bg-linear-bg-hover"
                    >
                      Elimină asocierea
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Document Picker - only show when a case is selected */}
            {caseId && (
              <DocumentPickerPopover
                caseId={caseId}
                clientId={clientId}
                selectedDocumentIds={selectedDocuments.map((d) => d.id)}
                onDocumentsChange={handleDocumentsChange}
                disabled={isLoading}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save Draft Button */}
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isLoading || savingDraft || (!to.trim() && !subject.trim() && !body.trim())}
            >
              {savingDraft ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : draftSaved ? (
                <Check className="h-4 w-4 mr-1.5 text-green-500" />
              ) : null}
              {draftSaved ? 'Salvat!' : 'Salvează ciornă'}
            </Button>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={isLoading || !to.trim() || !subject.trim() || !body.trim()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Trimite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
