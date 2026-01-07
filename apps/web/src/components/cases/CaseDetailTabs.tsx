'use client';

import * as React from 'react';
import { useMemo, useCallback, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { CaseEmailsTab, CaseDocumentsTab } from '@/components/case/tabs';
import {
  ChapterAccordion,
  CaseHistorySearchBar,
  RawActivityFallback,
  type SearchResult,
} from '@/components/case/chapters';
import { useCaseChapters } from '@/hooks/useCaseChapters';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import { DocumentPreviewModal } from '@/components/documents/DocumentPreviewModal';
import { useCaseSummary } from '@/hooks/mobile/useCaseSummary';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  Mail,
  StickyNote,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Case } from './index';

interface CaseDetailTabsProps {
  caseData: Case;
  userEmail: string;
  onTriggerSync?: () => Promise<void>;
  syncStatus?: 'Pending' | 'Syncing' | 'Completed' | 'Failed' | null;
}

// Section title component
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-normal text-linear-text-tertiary uppercase tracking-wider mb-4">
      {children}
    </h3>
  );
}

// Format relative time for "generatedAt"
function formatRelativeTime(date: string): string {
  const now = new Date();
  const generated = new Date(date);
  const diffMs = now.getTime() - generated.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'chiar acum';
  if (diffMins < 60) return `acum ${diffMins} min`;
  if (diffHours < 24) return `acum ${diffHours} ore`;
  if (diffDays === 1) return 'ieri';
  return `acum ${diffDays} zile`;
}

// Sinteza tab content - AI-generated summary
function SintezaContent({
  caseId,
  onTriggerSync,
  isSyncing,
}: {
  caseId: string;
  onTriggerSync?: () => Promise<void>;
  isSyncing?: boolean;
}) {
  const { summary, loading, generating, error, triggerGeneration } = useCaseSummary(caseId);
  const [syncTriggered, setSyncTriggered] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  // Handle sync trigger
  const handleTriggerSync = async () => {
    setSyncError(null);
    if (onTriggerSync) {
      setSyncTriggered(true);
      try {
        await onTriggerSync();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Eroare la sincronizare';
        setSyncError(message);
      } finally {
        setSyncTriggered(false);
      }
    } else {
      // Fallback to just regenerating summary if sync not available
      triggerGeneration();
    }
  };

  const isProcessing = generating || isSyncing || syncTriggered;

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca sinteza...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-linear-error mb-2">Eroare la incarcarea sintezei</p>
          <p className="text-xs text-linear-text-tertiary">{error.message}</p>
          <button
            onClick={handleTriggerSync}
            disabled={isProcessing}
            className="mt-4 px-4 py-2 text-sm bg-linear-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isProcessing ? 'Se sincronizeaza...' : 'Incearca din nou'}
          </button>
        </div>
      </div>
    );
  }

  // No summary yet - offer to generate
  if (!summary) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-accent/10 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-linear-accent" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Sinteza nu este disponibila
          </h3>
          <p className="text-sm text-linear-text-tertiary mb-6 max-w-sm mx-auto">
            Sincronizeaza dosarul pentru a genera o sinteza AI cu ce s-a intamplat si starea curenta.
          </p>
          <button
            onClick={handleTriggerSync}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-linear-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Se sincronizeaza...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sincronizeaza dosar
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-8 space-y-6">
        {/* Generation info header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-linear-accent" />
            <span className="text-xs text-linear-text-tertiary">
              Generat {formatRelativeTime(summary.generatedAt)}
            </span>
            {summary.isStale && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-linear-warning/10 text-linear-warning">
                Invechit
              </span>
            )}
          </div>
          <button
            onClick={handleTriggerSync}
            disabled={isProcessing}
            className="p-2 rounded-lg hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
            title="Sincronizeaza dosar"
          >
            <RefreshCw
              className={cn('w-4 h-4 text-linear-text-tertiary', isProcessing && 'animate-spin')}
            />
          </button>
        </div>

        {/* Sync error message */}
        {syncError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-linear-error/10 text-linear-error text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Executive Summary */}
        <section>
          <SectionTitle>Rezumat</SectionTitle>
          <p className="text-sm text-linear-text-primary leading-relaxed">
            {summary.executiveSummary}
          </p>
        </section>

        {/* Current Status */}
        <section>
          <SectionTitle>Stare curenta</SectionTitle>
          <p className="text-sm text-linear-text-secondary leading-relaxed">
            {summary.currentStatus}
          </p>
        </section>

        {/* Key Developments */}
        {summary.keyDevelopments.length > 0 && (
          <section>
            <SectionTitle>Evenimente cheie</SectionTitle>
            <ul className="space-y-2">
              {summary.keyDevelopments.map((development, index) => (
                <li key={index} className="flex gap-2 text-sm text-linear-text-secondary">
                  <span className="text-linear-accent mt-0.5">•</span>
                  <span>{development}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Open Issues */}
        {summary.openIssues.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-4">
              <AlertCircle className="w-3.5 h-3.5 text-linear-warning" />
              <h3 className="text-[11px] font-normal text-linear-text-tertiary uppercase tracking-wider">
                Probleme deschise
              </h3>
            </div>
            <ul className="space-y-2">
              {summary.openIssues.map((issue, index) => (
                <li key={index} className="flex gap-2 text-sm text-linear-text-secondary">
                  <span className="text-linear-warning mt-0.5">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Data stats */}
        <div className="pt-4 border-t border-linear-border-subtle">
          <div className="flex items-center gap-6 text-xs text-linear-text-tertiary">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{summary.emailCount} emailuri</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>{summary.documentCount} documente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              <span>{summary.noteCount} notite</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5" />
              <span>{summary.taskCount} taskuri</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// Istoric (History) tab content - AI-generated chapters and timeline
function IstoricContent({ caseId }: { caseId: string }) {
  const { chapters, loading, error, hasChapters, rawActivities } = useCaseChapters(caseId);
  const accordionRef = useRef<HTMLDivElement>(null);

  // Document preview
  const {
    isPreviewOpen,
    previewDocumentId,
    previewMethod,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
  } = useDocumentPreview();

  // Track the current preview document info for the modal
  const [previewDocument, setPreviewDocument] = React.useState<{
    id: string;
    fileName: string;
    fileType: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';
    fileSize?: number;
  } | null>(null);

  // Handle document click from activities
  const handleDocumentClick = useCallback(
    (documentId: string, fileType: string, fileName: string) => {
      // Map file extension to document type
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      let docType: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';
      if (['pdf', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
        docType = fileType as 'pdf' | 'docx' | 'xlsx' | 'pptx';
      } else if (imageTypes.includes(fileType)) {
        docType = 'image';
      } else {
        docType = 'other';
      }

      const docInfo = {
        id: documentId,
        fileName,
        fileType: docType,
      };
      setPreviewDocument(docInfo);
      openPreview(documentId, fileType);
    },
    [openPreview]
  );

  // Map raw activities to the format expected by RawActivityFallback
  const mappedActivities = useMemo(() => {
    return rawActivities.map((activity) => ({
      id: activity.id,
      type: activity.type.toLowerCase() as 'document' | 'email' | 'task' | 'status',
      title: activity.title,
      occurredAt: activity.occurredAt,
      metadata: {
        documentId: activity.metadata.documentId,
        emailId: activity.metadata.emailId,
        taskId: activity.metadata.taskId,
      },
    }));
  }, [rawActivities]);

  // Handle search result click - scroll to and expand chapter
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    // Find accordion item and expand it
    const accordionItem = accordionRef.current?.querySelector(
      `[data-chapter-id="${result.chapterId}"]`
    );
    if (accordionItem) {
      // Trigger click to expand if not already expanded
      const trigger = accordionItem.querySelector('[data-state="closed"]');
      if (trigger) {
        (trigger as HTMLElement).click();
      }
      // Scroll to the event after expansion animation
      setTimeout(() => {
        const eventElement = accordionRef.current?.querySelector(
          `[data-event-id="${result.eventId}"]`
        );
        eventElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca istoricul...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-linear-error mb-2">Eroare la incarcarea istoricului</p>
          <p className="text-xs text-linear-text-tertiary">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-8" ref={accordionRef}>
        {/* Search bar */}
        <CaseHistorySearchBar
          caseId={caseId}
          onResultClick={handleSearchResultClick}
          className="mb-6"
        />

        {/* Chapters accordion or raw fallback */}
        {hasChapters && chapters.length > 0 ? (
          <ChapterAccordion chapters={chapters} defaultExpandedId={chapters[0]?.id} />
        ) : (
          <RawActivityFallback
            activities={mappedActivities}
            loading={loading}
            onDocumentClick={handleDocumentClick}
          />
        )}
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        document={previewDocument}
        onRequestPreviewUrl={fetchPreviewUrl}
        onRequestDownloadUrl={fetchDownloadUrl}
        onRequestTextContent={fetchTextContent}
      />
    </ScrollArea>
  );
}

export function CaseDetailTabs({ caseData, userEmail, onTriggerSync, syncStatus }: CaseDetailTabsProps) {
  const isSyncing = syncStatus === 'Pending' || syncStatus === 'Syncing';

  return (
    <Tabs
      defaultValue="sinteza"
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <TabsList variant="underline" className="px-8 border-b border-linear-border-subtle">
        <TabsTrigger value="sinteza">Sinteza</TabsTrigger>
        <TabsTrigger value="istoric">Istoric</TabsTrigger>
        <TabsTrigger value="documente">Documente</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
      </TabsList>

      <TabsContent value="sinteza" className="mt-0 overflow-hidden min-h-0 flex flex-col">
        <SintezaContent caseId={caseData.id} onTriggerSync={onTriggerSync} isSyncing={isSyncing} />
      </TabsContent>

      <TabsContent value="istoric" className="mt-0 overflow-hidden min-h-0 flex flex-col">
        <IstoricContent caseId={caseData.id} />
      </TabsContent>

      <TabsContent value="documente" className="mt-0 overflow-auto self-start">
        <CaseDocumentsTab caseId={caseData.id} />
      </TabsContent>

      <TabsContent value="email" className="mt-0 overflow-hidden min-h-0 flex flex-col">
        <CaseEmailsTab
          caseId={caseData.id}
          caseName={caseData.title}
          userEmail={userEmail}
          className="flex-1 min-h-0"
        />
      </TabsContent>
    </Tabs>
  );
}

export default CaseDetailTabs;
