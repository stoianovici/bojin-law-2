'use client';

import { useState } from 'react';
import {
  RefreshCw,
  Folder,
  Building2,
  AlertCircle,
  Users,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ScrollArea } from '@/components/ui';
import { CaseAccordion } from './CaseAccordion';
import { ThreadItem } from './ThreadItem';
import { UncertainEmailItem } from './UncertainEmailItem';
import type {
  CaseWithThreads,
  CourtEmail,
  CourtEmailGroup,
  UncertainEmail,
  ClientWithCases,
} from '@/types/email';

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
  /** Court emails flat list (deprecated - use courtEmailGroups) */
  courtEmails: CourtEmail[];
  courtEmailsCount: number;
  /** Court emails grouped by source (court name) for subfolders */
  courtEmailGroups?: CourtEmailGroup[];
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
  courtEmailGroups = [],
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

  // State for expanded court subfolders
  const [expandedCourtIds, setExpandedCourtIds] = useState<string[]>([]);

  // State for collapsible warning sections (default all expanded)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    neatribuit: true,
    instante: true,
    neclar: true,
    clienti: true,
  });

  const toggleCourtExpanded = (courtId: string) => {
    setExpandedCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId]
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
        {/* CLIENȚI Section - Primary navigation by client */}
        <SectionHeader icon={Users} title="Clienți" count={totalCasesCount} />

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
              collapsible
              isExpanded={expandedSections.neatribuit}
              onToggle={() => toggleSection('neatribuit')}
            />
            {expandedSections.neatribuit && (
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
            )}
          </>
        )}

        {/* CLIENT INBOX Section (Multi-case clients with emails awaiting assignment) */}
        {clientsWithInbox.length > 0 && onSelectClientInbox && (
          <>
            <SectionHeader
              icon={Inbox}
              title="Inbox clienți"
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
            <SectionHeader
              icon={Building2}
              title="Instanțe"
              count={courtEmailsCount}
              isWarning
              collapsible
              isExpanded={expandedSections.instante}
              onToggle={() => toggleSection('instante')}
            />
            {expandedSections.instante && (
              <div>
                {/* Use grouped view if available, otherwise fall back to flat list */}
                {courtEmailGroups.length > 0
                  ? courtEmailGroups.map((group) => (
                      <CourtAccordion
                        key={group.id}
                        court={group}
                        isExpanded={expandedCourtIds.includes(group.id)}
                        selectedEmailId={selectedEmailId}
                        onToggle={() => toggleCourtExpanded(group.id)}
                        onSelectEmail={onSelectCourtEmail}
                      />
                    ))
                  : courtEmails.map((email) => (
                      <CourtEmailItem
                        key={email.id}
                        email={email}
                        isSelected={selectedEmailId === email.id}
                        onClick={() => onSelectCourtEmail(email.id)}
                      />
                    ))}
              </div>
            )}
          </>
        )}

        {/* NECLAR Section (Uncertain Emails) */}
        {uncertainEmailsCount > 0 && (
          <>
            <SectionHeader
              icon={AlertCircle}
              title="Neclar"
              count={uncertainEmailsCount}
              isWarning
              collapsible
              isExpanded={expandedSections.neclar}
              onToggle={() => toggleSection('neclar')}
            />
            {expandedSections.neclar && (
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
            )}
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
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  isWarning = false,
  collapsible = false,
  isExpanded = true,
  onToggle,
}: SectionHeaderProps) {
  const content = (
    <div className="flex items-center justify-between">
      <div
        className={cn(
          'flex items-center gap-2 text-sm',
          isWarning ? 'text-linear-warning' : 'text-linear-text-tertiary'
        )}
      >
        {collapsible && (
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')}
          />
        )}
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
  );

  if (collapsible) {
    return (
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle sticky top-0 z-10 hover:bg-linear-bg-hover transition-colors text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="px-4 py-2 bg-linear-bg-tertiary border-b border-linear-border-subtle sticky top-0 z-10">
      {content}
    </div>
  );
}

// Court Accordion Component (for grouped court emails)
interface CourtAccordionProps {
  court: CourtEmailGroup;
  isExpanded: boolean;
  selectedEmailId: string | null;
  onToggle: () => void;
  onSelectEmail: (emailId: string) => void;
}

function CourtAccordion({
  court,
  isExpanded,
  selectedEmailId,
  onToggle,
  onSelectEmail,
}: CourtAccordionProps) {
  return (
    <div className="border-b border-linear-border-subtle">
      {/* Court Header */}
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
            'h-4 w-4 text-linear-warning transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <Building2 className="h-4 w-4 text-linear-warning flex-shrink-0" />
        <span className="text-sm font-medium text-linear-text-primary truncate flex-1">
          {court.name}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-linear-warning/15 text-linear-warning">
          {court.count}
        </span>
      </button>

      {/* Expanded Content - Court Emails */}
      {isExpanded && (
        <div className="bg-linear-bg-elevated">
          {court.emails.map((email) => (
            <CourtEmailItem
              key={email.id}
              email={email}
              isSelected={selectedEmailId === email.id}
              onClick={() => onSelectEmail(email.id)}
              hideCourtBadge
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Court Email Item Component
interface CourtEmailItemProps {
  email: CourtEmail;
  isSelected: boolean;
  onClick: () => void;
  /** Hide the court badge when shown inside a court accordion */
  hideCourtBadge?: boolean;
}

function CourtEmailItem({
  email,
  isSelected,
  onClick,
  hideCourtBadge = false,
}: CourtEmailItemProps) {
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
      {/* Court Badge - only show when not in accordion */}
      {!hideCourtBadge && email.courtName && (
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
  // State for collapsible client inbox
  const [isInboxExpanded, setIsInboxExpanded] = useState(true);

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
          {/* Client Inbox Section - always show (even when empty) */}
          <div className="border-b border-linear-border-subtle">
            <button
              onClick={() => client.inboxTotalCount > 0 && setIsInboxExpanded(!isInboxExpanded)}
              className={cn(
                'w-full px-4 py-2 flex items-center gap-2 bg-linear-bg-tertiary transition-colors',
                client.inboxTotalCount > 0
                  ? 'hover:bg-linear-bg-hover cursor-pointer'
                  : 'cursor-default'
              )}
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  client.inboxTotalCount > 0
                    ? 'text-linear-warning'
                    : 'text-linear-text-tertiary opacity-0',
                  isInboxExpanded && client.inboxTotalCount > 0 && 'rotate-90'
                )}
              />
              <Inbox
                className={cn(
                  'h-3.5 w-3.5',
                  client.inboxTotalCount > 0 ? 'text-linear-warning' : 'text-linear-text-tertiary'
                )}
              />
              <span
                className={cn(
                  'text-sm truncate',
                  client.inboxTotalCount > 0 ? 'text-linear-warning' : 'text-linear-text-tertiary'
                )}
              >
                Inbox
              </span>
              {client.inboxTotalCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-linear-warning/15 text-linear-warning">
                  {client.inboxTotalCount}
                </span>
              )}
            </button>
            {isInboxExpanded && client.inboxTotalCount > 0 && (
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
            )}
          </div>

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

          {/* Empty state if no cases (inbox is always shown above) */}
          {client.cases.length === 0 && (
            <div className="px-4 py-3 text-xs text-linear-text-tertiary italic">
              Niciun dosar activ
            </div>
          )}
        </div>
      )}
    </div>
  );
}
