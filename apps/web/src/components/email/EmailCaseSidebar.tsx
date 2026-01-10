'use client';

import { useState } from 'react';
import { RefreshCw, Folder, Building2, AlertCircle, Users, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ScrollArea } from '@/components/ui';
import { CaseAccordion } from './CaseAccordion';
import { ThreadItem } from './ThreadItem';
import { UncertainEmailItem } from './UncertainEmailItem';
import type { CaseWithThreads, CourtEmail, UncertainEmail, ClientWithCases } from '@/types/email';

// Client with inbox emails (multi-case clients) - legacy type for backwards compatibility
interface ClientWithInbox {
  id: string;
  name: string;
  activeCasesCount: number;
  activeCases: Array<{ id: string; caseNumber: string; title: string }>;
  unreadCount: number;
  totalCount: number;
}

interface EmailCaseSidebarProps {
  /** Clients with their cases grouped (new structure) */
  clients?: ClientWithCases[];
  /** Cases flat list (deprecated, kept for backwards compatibility) */
  cases: CaseWithThreads[];
  unassignedCase: CaseWithThreads | null;
  courtEmails: CourtEmail[];
  courtEmailsCount: number;
  uncertainEmails: UncertainEmail[];
  uncertainEmailsCount: number;
  // Client inbox props (multi-case clients) - legacy
  clientsWithInbox?: ClientWithInbox[];
  selectedClientId?: string | null;
  onSelectClientInbox?: (clientId: string) => void;
  selectedThreadId: string | null;
  selectedEmailId: string | null;
  expandedCaseIds: string[];
  /** Expanded client IDs for the new grouped view */
  expandedClientIds?: string[];
  onSelectThread: (conversationId: string, caseId?: string) => void;
  onSelectCourtEmail: (emailId: string) => void;
  onSelectUncertainEmail: (emailId: string, conversationId?: string) => void;
  onToggleCaseExpanded: (caseId: string) => void;
  /** Toggle client expansion for the new grouped view */
  onToggleClientExpanded?: (clientId: string) => void;
  onSync: () => void;
  syncing: boolean;
  className?: string;
}

export function EmailCaseSidebar({
  clients = [],
  cases,
  unassignedCase,
  courtEmails,
  courtEmailsCount,
  uncertainEmails,
  uncertainEmailsCount,
  clientsWithInbox = [],
  selectedClientId,
  onSelectClientInbox,
  selectedThreadId,
  selectedEmailId,
  expandedCaseIds,
  expandedClientIds: externalExpandedClientIds,
  onSelectThread,
  onSelectCourtEmail,
  onSelectUncertainEmail,
  onToggleCaseExpanded,
  onToggleClientExpanded,
  onSync,
  syncing,
  className,
}: EmailCaseSidebarProps) {
  // Internal state for expanded clients if not controlled externally
  const [internalExpandedClientIds, setInternalExpandedClientIds] = useState<string[]>([]);
  const expandedClientIds = externalExpandedClientIds ?? internalExpandedClientIds;

  const handleToggleClientExpanded = (clientId: string) => {
    if (onToggleClientExpanded) {
      onToggleClientExpanded(clientId);
    } else {
      setInternalExpandedClientIds((prev) =>
        prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
      );
    }
  };

  // Use clients if available, otherwise fall back to flat cases
  const useClientGrouping = clients.length > 0;

  // Calculate total cases count for section header
  const totalCasesCount = useClientGrouping
    ? clients.reduce((sum, c) => sum + c.cases.length, 0)
    : cases.length;

  return (
    <div
      className={cn(
        'w-80 xl:w-96 2xl:w-[420px] flex-shrink-0 flex flex-col bg-linear-bg-primary border-r border-linear-border-subtle',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
        <span className="text-sm font-semibold text-linear-text-primary">Email</span>
        <Button variant="ghost" size="sm" onClick={onSync} disabled={syncing} className="h-8">
          <RefreshCw className={cn('h-4 w-4 mr-1.5', syncing && 'animate-spin')} />
          {syncing ? 'Se sincronizează...' : 'Sincronizare'}
        </Button>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        {/* DOSARE Section */}
        <SectionHeader icon={Folder} title="DOSARE" count={totalCasesCount} />

        {/* Client-grouped view (new) */}
        {useClientGrouping &&
          clients.map((client) => (
            <ClientAccordion
              key={client.id}
              client={client}
              isExpanded={expandedClientIds.includes(client.id)}
              expandedCaseIds={expandedCaseIds}
              selectedThreadId={selectedThreadId}
              onToggle={() => handleToggleClientExpanded(client.id)}
              onToggleCaseExpanded={onToggleCaseExpanded}
              onSelectThread={onSelectThread}
            />
          ))}

        {/* Flat case view (fallback/deprecated) */}
        {!useClientGrouping &&
          cases.map((caseData) => (
            <CaseAccordion
              key={caseData.id}
              caseData={caseData}
              isExpanded={expandedCaseIds.includes(caseData.id)}
              selectedThreadId={selectedThreadId}
              onToggle={() => onToggleCaseExpanded(caseData.id)}
              onSelectThread={onSelectThread}
            />
          ))}

        {/* Unassigned Section */}
        {unassignedCase && unassignedCase.threads.length > 0 && (
          <>
            <SectionHeader
              icon={Folder}
              title="NEATRIBUIT"
              count={unassignedCase.totalCount}
              isWarning
            />
            <div className="bg-linear-bg-elevated">
              {unassignedCase.threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.conversationId}
                  onClick={() => onSelectThread(thread.conversationId)}
                />
              ))}
            </div>
          </>
        )}

        {/* CLIENȚI Section (Multi-case clients with inbox emails) */}
        {clientsWithInbox.length > 0 && onSelectClientInbox && (
          <>
            <SectionHeader
              icon={Users}
              title="CLIENȚI"
              count={clientsWithInbox.reduce((sum, c) => sum + c.totalCount, 0)}
              isWarning
            />
            <div>
              {clientsWithInbox.map((client) => (
                <ClientInboxItem
                  key={client.id}
                  client={client}
                  isSelected={selectedClientId === client.id}
                  onClick={() => onSelectClientInbox(client.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* INSTANȚE Section (Court Emails) */}
        {courtEmailsCount > 0 && (
          <>
            <SectionHeader icon={Building2} title="INSTANȚE" count={courtEmailsCount} isWarning />
            <div>
              {courtEmails.map((email) => (
                <CourtEmailItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmailId === email.id}
                  onClick={() => onSelectCourtEmail(email.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* NECLAR Section (Uncertain Emails) */}
        {uncertainEmailsCount > 0 && (
          <>
            <SectionHeader
              icon={AlertCircle}
              title="NECLAR"
              count={uncertainEmailsCount}
              isWarning
            />
            <div>
              {uncertainEmails.map((email) => (
                <UncertainEmailItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmailId === email.id}
                  onClick={() => onSelectUncertainEmail(email.id, email.conversationId)}
                />
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}

// Section Header Component
interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  count?: number;
  isWarning?: boolean;
}

function SectionHeader({ icon: Icon, title, count, isWarning = false }: SectionHeaderProps) {
  return (
    <div className="px-4 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
            isWarning ? 'text-linear-warning' : 'text-linear-text-tertiary'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              isWarning
                ? 'bg-linear-warning/15 text-linear-warning'
                : 'bg-linear-bg-hover text-linear-text-secondary'
            )}
          >
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

// Court Email Item Component
interface CourtEmailItemProps {
  email: CourtEmail;
  isSelected: boolean;
  onClick: () => void;
}

function CourtEmailItem({ email, isSelected, onClick }: CourtEmailItemProps) {
  const formattedDate = formatRelativeDate(email.receivedDateTime);

  return (
    <div
      className={cn(
        'px-4 py-3 cursor-pointer transition-colors border-b border-linear-border-subtle',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent/10 border-l-2 border-l-linear-accent'
      )}
      onClick={onClick}
    >
      {/* Court Badge */}
      {email.courtName && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 rounded text-xs font-medium bg-linear-warning/15 text-linear-warning">
          <Building2 className="h-3 w-3" />
          {email.courtName.toUpperCase()}
        </div>
      )}

      {/* Subject */}
      <div className="text-sm text-linear-text-primary line-clamp-1 mb-1">
        {email.subject || '(Fără subiect)'}
      </div>

      {/* Preview */}
      <div className="text-xs text-linear-text-tertiary line-clamp-1 mb-1">{email.bodyPreview}</div>

      {/* Date */}
      <div className="text-xs text-linear-text-tertiary">{formattedDate}</div>
    </div>
  );
}

// Helper function for relative dates
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'ieri';
  } else if (diffDays < 7) {
    return `${diffDays} zile`;
  } else {
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
}

// Client Inbox Item Component (Multi-case clients)
interface ClientInboxItemProps {
  client: ClientWithInbox;
  isSelected: boolean;
  onClick: () => void;
}

function ClientInboxItem({ client, isSelected, onClick }: ClientInboxItemProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 cursor-pointer transition-colors border-b border-linear-border-subtle',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent/10 border-l-2 border-l-linear-accent'
      )}
      onClick={onClick}
    >
      {/* Client Name */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
          <span className="text-sm font-medium text-linear-text-primary truncate">
            {client.name}
          </span>
        </div>
        {client.unreadCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-linear-accent/15 text-linear-accent flex-shrink-0">
            {client.unreadCount}
          </span>
        )}
      </div>

      {/* Active Cases Count */}
      <div className="text-xs text-linear-text-tertiary">
        {client.activeCasesCount} {client.activeCasesCount === 1 ? 'dosar activ' : 'dosare active'}{' '}
        • {client.totalCount} {client.totalCount === 1 ? 'email' : 'emailuri'}
      </div>
    </div>
  );
}

// Client Accordion Component (New grouped view)
interface ClientAccordionProps {
  client: ClientWithCases;
  isExpanded: boolean;
  expandedCaseIds: string[];
  selectedThreadId: string | null;
  onToggle: () => void;
  onToggleCaseExpanded: (caseId: string) => void;
  onSelectThread: (conversationId: string, caseId?: string) => void;
}

function ClientAccordion({
  client,
  isExpanded,
  expandedCaseIds,
  selectedThreadId,
  onToggle,
  onToggleCaseExpanded,
  onSelectThread,
}: ClientAccordionProps) {
  // Calculate total unread across inbox + all cases
  const totalUnread = client.inboxUnreadCount + client.totalUnreadCount;
  // Calculate total threads across inbox + all cases
  const totalThreads = client.inboxTotalCount + client.totalCount;

  return (
    <div className="border-b border-linear-border-subtle">
      {/* Client Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors',
          'hover:bg-linear-bg-hover',
          isExpanded && 'bg-linear-bg-elevated'
        )}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-linear-text-tertiary transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <Users className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
        <span className="text-sm font-medium text-linear-text-primary truncate flex-1">
          {client.name}
        </span>
        <span className="text-xs text-linear-text-tertiary">
          {client.cases.length} {client.cases.length === 1 ? 'dosar' : 'dosare'}
        </span>
        {totalUnread > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-linear-accent/15 text-linear-accent">
            {totalUnread}
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="bg-linear-bg-elevated">
          {/* Client Inbox Section (if has inbox threads) */}
          {client.inboxTotalCount > 0 && (
            <div className="border-b border-linear-border-subtle">
              <div className="px-4 py-2 flex items-center gap-2 bg-linear-bg-tertiary">
                <Inbox className="h-3.5 w-3.5 text-linear-warning" />
                <span className="text-xs font-medium text-linear-warning uppercase">
                  Inbox Client
                </span>
                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-linear-warning/15 text-linear-warning">
                  {client.inboxTotalCount}
                </span>
              </div>
              <div className="pl-4">
                {client.inboxThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.conversationId}
                    onClick={() => onSelectThread(thread.conversationId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cases within this client */}
          {client.cases.map((caseData) => (
            <CaseAccordion
              key={caseData.id}
              caseData={caseData}
              isExpanded={expandedCaseIds.includes(caseData.id)}
              selectedThreadId={selectedThreadId}
              onToggle={() => onToggleCaseExpanded(caseData.id)}
              onSelectThread={onSelectThread}
              indented
            />
          ))}

          {/* Empty state if no cases */}
          {client.cases.length === 0 && client.inboxTotalCount === 0 && (
            <div className="px-4 py-3 text-xs text-linear-text-tertiary italic">
              Niciun dosar activ
            </div>
          )}
        </div>
      )}
    </div>
  );
}
