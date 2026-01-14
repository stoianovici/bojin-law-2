'use client';

import { useState, useCallback, useMemo } from 'react';
import { Search, Folder, Check, Loader2, UserPlus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Badge,
} from '@/components/ui';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { useQuery } from '@/hooks/useGraphQL';
import { GET_CASES } from '@/graphql/queries';
import type { CaseSuggestion } from '@/types/email';

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

interface AssignmentResult {
  thread: {
    id: string;
    conversationId: string;
    case: {
      id: string;
      title: string;
      caseNumber: string;
      referenceNumbers?: string[];
    };
  };
  newContactAdded: boolean;
  contactName: string | null;
  contactEmail: string | null;
}

interface CaseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (caseId: string) => Promise<AssignmentResult | null>;
  threadSubject?: string;
  senderName?: string;
  senderEmail?: string;
  suggestedCases?: CaseSuggestion[];
  currentCaseId?: string | null;
  isReassign?: boolean;
  /** Filter cases to show only this client's cases */
  clientId?: string;
}

export function CaseAssignmentModal({
  isOpen,
  onClose,
  onAssign,
  threadSubject,
  senderName,
  senderEmail,
  suggestedCases = [],
  currentCaseId,
  isReassign = false,
  clientId,
}: CaseAssignmentModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all cases
  const { data: casesData, loading: casesLoading } = useQuery<GetCasesResponse>(GET_CASES);

  // Filter cases by clientId if provided (client inbox mode)
  const allCases = useMemo(() => {
    const cases = casesData?.cases || [];
    if (clientId) {
      return cases.filter((c) => c.client.id === clientId);
    }
    return cases;
  }, [casesData?.cases, clientId]);

  // Get client name for display when filtering by client
  const clientName = useMemo(() => {
    if (!clientId || !casesData?.cases) return undefined;
    const clientCase = casesData.cases.find((c) => c.client.id === clientId);
    return clientCase?.client.name;
  }, [clientId, casesData?.cases]);

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return allCases;
    const query = searchQuery.toLowerCase();
    return allCases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.client.name.toLowerCase().includes(query)
    );
  }, [allCases, searchQuery]);

  // Merge suggested cases with all cases for display
  const suggestedCaseIds = new Set(suggestedCases.map((s) => s.id));

  // Sort: suggested cases first (by confidence), then others
  const sortedCases = useMemo(() => {
    const suggested = filteredCases
      .filter((c) => suggestedCaseIds.has(c.id))
      .map((c) => ({
        ...c,
        confidence: suggestedCases.find((s) => s.id === c.id)?.confidence || 0,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    const others = filteredCases.filter((c) => !suggestedCaseIds.has(c.id));

    return { suggested, others };
  }, [filteredCases, suggestedCaseIds, suggestedCases]);

  // Reset state when modal opens/closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSearchQuery('');
        setSelectedCaseId(null);
        setAssignmentResult(null);
        setError(null);
        onClose();
      }
    },
    [onClose]
  );

  // Handle assignment
  const handleAssign = useCallback(async () => {
    if (!selectedCaseId) return;

    setAssigning(true);
    setError(null);

    try {
      const result = await onAssign(selectedCaseId);
      if (result) {
        setAssignmentResult(result);
        // Auto close after showing success for a moment
        setTimeout(() => {
          handleOpenChange(false);
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la atribuirea emailului');
    } finally {
      setAssigning(false);
    }
  }, [selectedCaseId, onAssign, handleOpenChange]);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    if (confidence >= 0.4) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    return 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30';
  };

  // Render case item
  const renderCaseItem = (caseItem: CaseItem & { confidence?: number }, isSuggested = false) => {
    const isSelected = selectedCaseId === caseItem.id;
    const isCurrent = currentCaseId === caseItem.id;

    return (
      <button
        key={caseItem.id}
        onClick={() => setSelectedCaseId(caseItem.id)}
        disabled={isCurrent || assigning}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
          'hover:bg-linear-bg-hover',
          isSelected && 'bg-linear-accent/10 ring-1 ring-linear-accent/30',
          isCurrent && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex-shrink-0">
          <Folder
            className={cn(
              'h-4 w-4',
              isSelected ? 'text-linear-accent' : 'text-linear-text-tertiary'
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {caseItem.referenceNumbers?.[0] && (
              <span className="text-xs font-medium text-linear-text-secondary">
                {caseItem.referenceNumbers[0]}
              </span>
            )}
            {isCurrent && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                Actual
              </Badge>
            )}
            {isSuggested && caseItem.confidence !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium border',
                  getConfidenceColor(caseItem.confidence)
                )}
              >
                {Math.round(caseItem.confidence * 100)}%
              </span>
            )}
          </div>
          <div className="text-sm text-linear-text-primary truncate">{caseItem.title}</div>
          <div className="text-xs text-linear-text-tertiary truncate">{caseItem.client.name}</div>
        </div>
        {isSelected && <Check className="h-4 w-4 text-linear-accent flex-shrink-0" />}
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isReassign ? 'Reasignează email' : 'Atribuie email la dosar'}</DialogTitle>
          {(threadSubject || clientName) && (
            <DialogDescription className="line-clamp-2">
              {threadSubject && <span className="block">{threadSubject}</span>}
              {clientName && (
                <span className="text-linear-accent">Dosarele clientului {clientName}</span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Success State */}
        {assignmentResult && (
          <div className="py-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-base font-medium text-linear-text-primary mb-1">
                Email atribuit cu succes!
              </p>
              <p className="text-sm text-linear-text-secondary mb-3">
                {assignmentResult.thread.case.referenceNumbers?.[0] && (
                  <>{assignmentResult.thread.case.referenceNumbers[0]} - </>
                )}
                {assignmentResult.thread.case.title}
              </p>

              {/* Contact Added Notification */}
              {assignmentResult.newContactAdded && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-linear-accent/10 border border-linear-accent/30 rounded-lg">
                  <UserPlus className="h-4 w-4 text-linear-accent" />
                  <span className="text-sm text-linear-accent">
                    Contactul{' '}
                    <span className="font-medium">
                      {assignmentResult.contactName || assignmentResult.contactEmail}
                    </span>{' '}
                    a fost adăugat la dosar
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        {!assignmentResult && (
          <>
            {/* Sender Info */}
            {(senderName || senderEmail) && (
              <div className="px-1 py-2 mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <UserPlus className="h-4 w-4 text-linear-text-tertiary" />
                  <span className="text-linear-text-secondary">
                    Contactul{' '}
                    <span className="text-linear-text-primary font-medium">
                      {senderName || senderEmail}
                    </span>{' '}
                    va fi adăugat la dosarul selectat
                  </span>
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-linear-text-tertiary" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  clientId
                    ? 'Caută dosar după nume sau număr...'
                    : 'Caută dosar după nume, număr sau client...'
                }
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Error State */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-linear-error/10 border border-linear-error/30 rounded-lg text-sm text-linear-error">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Cases List */}
            <ScrollArea className="h-[300px] -mx-6 px-6">
              {casesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-linear-text-tertiary" />
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="py-12 text-center">
                  <Folder className="h-8 w-8 mx-auto mb-2 text-linear-text-tertiary" />
                  <p className="text-sm text-linear-text-tertiary">
                    {searchQuery
                      ? 'Niciun dosar găsit'
                      : clientName
                        ? `${clientName} nu are dosare active`
                        : 'Nu există dosare disponibile'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Suggested Cases Section */}
                  {sortedCases.suggested.length > 0 && !searchQuery && (
                    <div>
                      <div className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wider mb-2 px-1">
                        Sugestii ({sortedCases.suggested.length})
                      </div>
                      <div className="space-y-1">
                        {sortedCases.suggested.map((c) => renderCaseItem(c, true))}
                      </div>
                    </div>
                  )}

                  {/* Other Cases Section */}
                  {sortedCases.others.length > 0 && (
                    <div>
                      {sortedCases.suggested.length > 0 && !searchQuery && (
                        <div className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wider mb-2 px-1">
                          {clientName ? `Dosarele ${clientName}` : 'Toate dosarele'}
                        </div>
                      )}
                      <div className="space-y-1">
                        {sortedCases.others.map((c) => renderCaseItem(c))}
                      </div>
                    </div>
                  )}

                  {/* If searching, show all filtered without sections */}
                  {searchQuery && (
                    <div className="space-y-1">
                      {filteredCases.map((c) => {
                        const suggestion = suggestedCases.find((s) => s.id === c.id);
                        return renderCaseItem(
                          { ...c, confidence: suggestion?.confidence },
                          !!suggestion
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={assigning}>
                Anulează
              </Button>
              <Button onClick={handleAssign} disabled={!selectedCaseId || assigning}>
                {assigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Se atribuie...
                  </>
                ) : (
                  <>
                    <Folder className="h-4 w-4 mr-2" />
                    {isReassign ? 'Reasignează' : 'Atribuie'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
