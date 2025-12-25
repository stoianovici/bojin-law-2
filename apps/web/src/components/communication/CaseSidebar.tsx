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
import { motion, AnimatePresence } from 'framer-motion';
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
  Link2,
} from 'lucide-react';
import type {
  CaseWithThreads,
  ThreadPreview,
  UnassignedCourtEmail,
  UncertainEmail,
} from '../../hooks/useMyEmailsByCase';

// ============================================================================
// Animation Variants
// ============================================================================

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

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
  /** OPS-206: Callback for selecting unassigned threads in NECLAR section */
  onSelectUnassignedThread?: (conversationId: string) => void;
  onMoveThread?: (info: MoveThreadInfo) => void;
  // OPS-132: Load more support
  hasMoreThreads?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
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
            {/* OPS-062: Multi-case badge */}
            {(thread.linkedCasesCount ?? 0) > 1 && (
              <span
                className="inline-flex items-center gap-0.5 px-1 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded"
                title={`Email în ${thread.linkedCasesCount} dosare`}
              >
                <Link2 className="h-2.5 w-2.5" />+{(thread.linkedCasesCount ?? 0) - 1}
              </span>
            )}
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
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="bg-gray-50/50"
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {caseData.threads.map((thread) => (
              <motion.div key={thread.id} variants={listItemVariants}>
                <ThreadItem
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
                            currentCaseTitle:
                              caseData.id !== 'unassigned' ? caseData.title : undefined,
                          })
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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

  // OPS-189: Sender-first display for consistency with UncertainEmailItem
  const senderName = email.from.name || email.from.address.split('@')[0];
  const senderEmail = email.from.address;
  const hasName = Boolean(email.from.name);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2.5 text-left transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-blue-50 border-l-2 border-blue-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      )}
    >
      {/* Sender name - prominent */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{senderName}</p>
        <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
      </div>

      {/* Email address - only if we have a name */}
      {hasName && <p className="text-xs text-gray-500 truncate mt-0.5">{senderEmail}</p>}

      {/* Subject - smaller, quoted style */}
      <p className="text-xs text-gray-600 italic truncate mt-1">
        &ldquo;{email.subject || 'Fără subiect'}&rdquo;
      </p>

      {/* Extracted case references */}
      {email.extractedReferences.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
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

  // OPS-189: Sender-first display for better classification decisions
  const senderName = email.from.name || email.from.address.split('@')[0];
  const senderEmail = email.from.address;
  const hasName = Boolean(email.from.name);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2.5 text-left transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-amber-50 border-l-2 border-amber-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      )}
    >
      {/* Sender name - prominent */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{senderName}</p>
        <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
      </div>

      {/* Email address - only if we have a name, otherwise it's redundant */}
      {hasName && <p className="text-xs text-gray-500 truncate mt-0.5">{senderEmail}</p>}

      {/* Subject - smaller, quoted style */}
      <p className="text-xs text-gray-600 italic truncate mt-1">
        &ldquo;{email.subject || 'Fără subiect'}&rdquo;
      </p>

      {/* Suggested cases indicator */}
      {email.suggestedCases.length > 0 && (
        <p className="mt-1.5 text-xs text-amber-600">
          {email.suggestedCases.length} dosar{email.suggestedCases.length === 1 ? '' : 'e'} sugerat
          {email.suggestedCases.length === 1 ? '' : 'e'}
        </p>
      )}
    </button>
  );
}

/**
 * OPS-206: Unassigned thread item for merged NECLAR section
 * Displays unassigned threads in the same style as UncertainEmailItem
 */
function UnassignedThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: ThreadPreview;
  isSelected: boolean;
  onClick: () => void;
}) {
  const formattedDate = new Date(thread.lastMessageDate).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  // Use latestFrom for sender info
  const senderName =
    thread.latestFrom?.name || thread.latestFrom?.address?.split('@')[0] || 'Necunoscut';
  const senderEmail = thread.latestFrom?.address;
  const hasName = Boolean(thread.latestFrom?.name);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2.5 text-left transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-amber-50 border-l-2 border-amber-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      )}
    >
      {/* Sender name - prominent */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{senderName}</p>
        <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
      </div>

      {/* Email address - only if we have a name */}
      {hasName && senderEmail && (
        <p className="text-xs text-gray-500 truncate mt-0.5">{senderEmail}</p>
      )}

      {/* Subject - smaller, quoted style */}
      <p className="text-xs text-gray-600 italic truncate mt-1">
        &ldquo;{thread.subject || 'Fără subiect'}&rdquo;
      </p>

      {/* Thread meta: message count, unread, attachments */}
      <div className="flex items-center gap-2 mt-1.5">
        {thread.messageCount > 1 && (
          <span className="text-xs text-gray-400">{thread.messageCount} mesaje</span>
        )}
        {thread.hasUnread && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
        {thread.hasAttachments && <Paperclip className="h-3 w-3 text-gray-400" />}
      </div>
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
  onSelectUnassignedThread,
  onMoveThread,
  // OPS-132: Load more support
  hasMoreThreads,
  onLoadMore,
  loadingMore,
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
  // OPS-206: Count unassigned threads to include in NECLAR count
  const unassignedThreadCount = unassignedCase?.totalThreads || 0;
  // OPS-206: Combined count for merged NECLAR section
  const mergedNeclarCount = uncertainCount + unassignedThreadCount;
  const hasMergedNeclar = mergedNeclarCount > 0;

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* DOSARE Section */}
        <div>
          <button onClick={() => toggleSection('dosare')} className="w-full">
            {/* OPS-206: Exclude unassigned threads from DOSARE count - they go to NECLAR */}
            <SectionHeader icon={Folder} title="DOSARE" count={totalCaseThreads} />
          </button>

          {!collapsedSections.has('dosare') && (
            <>
              {/* OPS-206: Check only assigned cases (unassigned moved to NECLAR) */}
              {cases.length === 0 ? (
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

                  {/* OPS-206: Unassigned threads moved to NECLAR section - removed from here */}

                  {/* OPS-132: Load more button */}
                  {hasMoreThreads && onLoadMore && (
                    <div className="p-3 border-t border-gray-100">
                      <button
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingMore ? 'Se încarcă...' : 'Încarcă mai multe conversații'}
                      </button>
                    </div>
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

            <AnimatePresence>
              {!collapsedSections.has('instante') && (
                <motion.div
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {courtUnassigned.map((email) => (
                    <motion.div key={email.id} variants={listItemVariants}>
                      <CourtEmailItem
                        email={email}
                        isSelected={selectedEmailId === email.id}
                        onClick={() => onSelectCourtEmail(email.id)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* OPS-206: Merged NECLAR Section (Uncertain emails + Unassigned threads) */}
        {hasMergedNeclar && (
          <div>
            <button onClick={() => toggleSection('neclar')} className="w-full">
              <SectionHeader
                icon={AlertCircle}
                title="NECLAR"
                count={mergedNeclarCount}
                isWarning
              />
            </button>

            <AnimatePresence>
              {!collapsedSections.has('neclar') && (
                <motion.div
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {/* Uncertain emails */}
                  {uncertain.map((email) => (
                    <motion.div key={`uncertain-${email.id}`} variants={listItemVariants}>
                      <UncertainEmailItem
                        email={email}
                        isSelected={selectedEmailId === email.id}
                        onClick={() => onSelectUncertainEmail(email.id)}
                      />
                    </motion.div>
                  ))}
                  {/* OPS-206: Unassigned threads (non-court) */}
                  {unassignedCase?.threads.map((thread) => (
                    <motion.div key={`thread-${thread.id}`} variants={listItemVariants}>
                      <UnassignedThreadItem
                        thread={thread}
                        isSelected={selectedThreadId === thread.conversationId}
                        onClick={() =>
                          // Use dedicated callback if available, otherwise fall back to regular thread selection
                          onSelectUnassignedThread
                            ? onSelectUnassignedThread(thread.conversationId)
                            : onSelectThread(thread.conversationId)
                        }
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

CaseSidebar.displayName = 'CaseSidebar';

export default CaseSidebar;
