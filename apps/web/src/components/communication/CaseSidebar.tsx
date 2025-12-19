'use client';

/**
 * CaseSidebar Component
 * OPS-041: /communications Case-Organized Redesign
 *
 * Left sidebar for the /communications page showing:
 * - DOSARE: Cases with expandable thread lists
 * - INSTANȚE: Unassigned court emails
 * - NECLAR: Uncertain emails needing classification
 */

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Folder,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Mail,
  Paperclip,
  MoreVertical,
  ArrowRightLeft,
} from 'lucide-react';
import type {
  CaseWithThreads,
  ThreadPreview,
  UnassignedCourtEmail,
  UncertainEmail,
} from '../../hooks/useMyEmailsByCase';

// ============================================================================
// Types
// ============================================================================

export interface MoveThreadInfo {
  conversationId: string;
  subject: string;
  currentCaseId?: string;
  currentCaseTitle?: string;
}

interface CaseSidebarProps {
  cases: CaseWithThreads[];
  unassignedCase: CaseWithThreads | null;
  courtUnassigned: UnassignedCourtEmail[];
  courtUnassignedCount: number;
  uncertain: UncertainEmail[];
  uncertainCount: number;
  selectedThreadId: string | null;
  selectedEmailId: string | null;
  onSelectThread: (conversationId: string, caseId?: string) => void;
  onSelectCourtEmail: (emailId: string) => void;
  onSelectUncertainEmail: (emailId: string) => void;
  onMoveThread?: (info: MoveThreadInfo) => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function SectionHeader({
  icon: Icon,
  title,
  count,
  isWarning = false,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  isWarning?: boolean;
}) {
  return (
    <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon className={clsx('h-4 w-4', isWarning ? 'text-amber-500' : 'text-gray-500')} />
          {title}
        </div>
        {count !== undefined && count > 0 && (
          <span
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              isWarning ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
            )}
          >
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

function ThreadItem({
  thread,
  isSelected,
  onClick,
  onMoveClick,
}: {
  thread: ThreadPreview;
  isSelected: boolean;
  onClick: () => void;
  onMoveClick?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const formattedDate = new Date(thread.lastMessageDate).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleMoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onMoveClick?.();
  };

  // Close menu when clicking outside
  const handleBlur = () => {
    // Small delay to allow click event to fire first
    setTimeout(() => setShowMenu(false), 150);
  };

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={clsx(
          'w-full px-3 py-2 text-left text-sm transition-colors',
          isSelected
            ? 'bg-blue-50 border-l-2 border-blue-500'
            : 'hover:bg-gray-50 border-l-2 border-transparent'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                'truncate',
                thread.hasUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
              )}
            >
              {thread.subject || '(Fără subiect)'}
            </p>
            {thread.latestFrom && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {thread.latestFrom.name || thread.latestFrom.address}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {thread.hasAttachments && <Paperclip className="h-3 w-3 text-gray-400" />}
            {thread.hasUnread && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">{formattedDate}</span>
          {thread.messageCount > 1 && (
            <span className="text-xs text-gray-400">{thread.messageCount} mesaje</span>
          )}
        </div>
      </button>

      {/* Kebab menu button - visible on hover */}
      {onMoveClick && (
        <button
          onClick={handleMenuClick}
          onBlur={handleBlur}
          className={clsx(
            'absolute right-2 top-2 p-1 rounded hover:bg-gray-200 transition-opacity',
            showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          aria-label="Opțiuni"
        >
          <MoreVertical className="h-4 w-4 text-gray-500" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-2 top-8 z-20 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
          <button
            onClick={handleMoveClick}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Mută în alt dosar
          </button>
        </div>
      )}
    </div>
  );
}

function CaseAccordionItem({
  caseData,
  isExpanded,
  onToggle,
  selectedThreadId,
  onSelectThread,
  onMoveThread,
}: {
  caseData: CaseWithThreads;
  isExpanded: boolean;
  onToggle: () => void;
  selectedThreadId: string | null;
  onSelectThread: (conversationId: string, caseId?: string) => void;
  onMoveThread?: (info: MoveThreadInfo) => void;
}) {
  return (
    <div className="border-b border-gray-100">
      {/* Case Header */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
          <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-900 truncate">{caseData.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {caseData.unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              {caseData.unreadCount}
            </span>
          )}
          <span className="text-xs text-gray-400">({caseData.totalThreads})</span>
        </div>
      </button>

      {/* Thread List (when expanded) */}
      {isExpanded && (
        <div className="bg-gray-50/50">
          {caseData.threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={selectedThreadId === thread.conversationId}
              onClick={() => onSelectThread(thread.conversationId, caseData.id)}
              onMoveClick={
                onMoveThread
                  ? () =>
                      onMoveThread({
                        conversationId: thread.conversationId,
                        subject: thread.subject,
                        currentCaseId: caseData.id !== 'unassigned' ? caseData.id : undefined,
                        currentCaseTitle: caseData.id !== 'unassigned' ? caseData.title : undefined,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourtEmailItem({
  email,
  isSelected,
  onClick,
}: {
  email: UnassignedCourtEmail;
  isSelected: boolean;
  onClick: () => void;
}) {
  const formattedDate = new Date(email.receivedDateTime).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2 text-left text-sm transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-blue-50 border-l-2 border-blue-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{email.subject || '(Fără subiect)'}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {email.from.name || email.from.address}
          </p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
      </div>
      {email.extractedReferences.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {email.extractedReferences.slice(0, 2).map((ref, idx) => (
            <span key={idx} className="px-1.5 py-0.5 text-xs bg-purple-50 text-purple-700 rounded">
              {ref}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function UncertainEmailItem({
  email,
  isSelected,
  onClick,
}: {
  email: UncertainEmail;
  isSelected: boolean;
  onClick: () => void;
}) {
  const formattedDate = new Date(email.receivedDateTime).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2 text-left text-sm transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-amber-50 border-l-2 border-amber-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{email.subject || '(Fără subiect)'}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {email.from.name || email.from.address}
          </p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
      </div>
      {email.suggestedCases.length > 0 && (
        <p className="mt-1 text-xs text-amber-600">
          {email.suggestedCases.length} dosar{email.suggestedCases.length === 1 ? '' : 'e'} sugerat
          {email.suggestedCases.length === 1 ? '' : 'e'}
        </p>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseSidebar({
  cases,
  unassignedCase,
  courtUnassigned,
  courtUnassignedCount,
  uncertain,
  uncertainCount,
  selectedThreadId,
  selectedEmailId,
  onSelectThread,
  onSelectCourtEmail,
  onSelectUncertainEmail,
  onMoveThread,
  className,
}: CaseSidebarProps) {
  // Track which cases are expanded (default: expand cases with unread)
  const [expandedCases, setExpandedCases] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    cases.forEach((c) => {
      if (c.unreadCount > 0) {
        initialExpanded.add(c.id);
      }
    });
    // Also expand unassigned if it has unread
    if (unassignedCase && unassignedCase.unreadCount > 0) {
      initialExpanded.add('unassigned');
    }
    return initialExpanded;
  });

  // Track which sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleCase = useCallback((caseId: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const totalCaseThreads = cases.reduce((sum, c) => sum + c.totalThreads, 0);
  const hasCourtEmails = courtUnassignedCount > 0;
  const hasUncertainEmails = uncertainCount > 0;

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* DOSARE Section */}
        <div>
          <button onClick={() => toggleSection('dosare')} className="w-full">
            <SectionHeader
              icon={Folder}
              title="DOSARE"
              count={totalCaseThreads + (unassignedCase?.totalThreads || 0)}
            />
          </button>

          {!collapsedSections.has('dosare') && (
            <>
              {cases.length === 0 && !unassignedCase ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  Nu aveți emailuri în dosare active
                </div>
              ) : (
                <>
                  {cases.map((caseData) => (
                    <CaseAccordionItem
                      key={caseData.id}
                      caseData={caseData}
                      isExpanded={expandedCases.has(caseData.id)}
                      onToggle={() => toggleCase(caseData.id)}
                      selectedThreadId={selectedThreadId}
                      onSelectThread={onSelectThread}
                      onMoveThread={onMoveThread}
                    />
                  ))}

                  {/* Unassigned threads */}
                  {unassignedCase && (
                    <CaseAccordionItem
                      key="unassigned"
                      caseData={unassignedCase}
                      isExpanded={expandedCases.has('unassigned')}
                      onToggle={() => toggleCase('unassigned')}
                      selectedThreadId={selectedThreadId}
                      onSelectThread={onSelectThread}
                      onMoveThread={onMoveThread}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* INSTANȚE Section (Court emails) */}
        {hasCourtEmails && (
          <div>
            <button onClick={() => toggleSection('instante')} className="w-full">
              <SectionHeader icon={Building2} title="INSTANȚE" count={courtUnassignedCount} />
            </button>

            {!collapsedSections.has('instante') && (
              <>
                {courtUnassigned.map((email) => (
                  <CourtEmailItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmailId === email.id}
                    onClick={() => onSelectCourtEmail(email.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* NECLAR Section (Uncertain emails) */}
        {hasUncertainEmails && (
          <div>
            <button onClick={() => toggleSection('neclar')} className="w-full">
              <SectionHeader icon={AlertCircle} title="NECLAR" count={uncertainCount} isWarning />
            </button>

            {!collapsedSections.has('neclar') && (
              <>
                {uncertain.map((email) => (
                  <UncertainEmailItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmailId === email.id}
                    onClick={() => onSelectUncertainEmail(email.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

CaseSidebar.displayName = 'CaseSidebar';

export default CaseSidebar;
