'use client';

/**
 * Extracted Items Panel Component
 * Story 5.2: Communication Intelligence Engine
 *
 * Displays AI-extracted items (deadlines, commitments, action items, questions)
 * from emails with confidence indicators and quick actions.
 *
 * Uses GraphQL API via useExtractedItems hooks.
 */

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Clock,
  ClipboardList,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  X,
  ExternalLink,
  Loader2,
  Mail,
} from 'lucide-react';
import {
  usePendingExtractedItems,
  useConvertToTask,
  useDismissExtraction,
  useMarkQuestionAnswered,
  type ExtractedDeadline,
  type ExtractedCommitment,
  type ExtractionConfidence,
  type ExtractionType,
} from '../../hooks/useExtractedItems';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

interface ExtractedItemsPanelProps {
  caseId: string;
  onAddToCalendar?: (item: ExtractedDeadline | ExtractedCommitment) => void;
}

type SectionType = 'deadlines' | 'commitments' | 'actionItems' | 'questions';

// ============================================================================
// Confidence Badge Component
// ============================================================================

interface ConfidenceBadgeProps {
  level: ExtractionConfidence;
}

function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const config = {
    High: { bg: 'bg-linear-success/15', text: 'text-linear-success', label: 'High confidence' },
    Medium: { bg: 'bg-linear-warning/15', text: 'text-linear-warning', label: 'Medium confidence' },
    Low: { bg: 'bg-linear-error/15', text: 'text-linear-error', label: 'Low confidence' },
  };

  const { bg, text, label } = config[level];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
      aria-label={label}
    >
      {level}
    </span>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  sectionId: string;
}

function SectionHeader({
  title,
  count,
  icon,
  isExpanded,
  onToggle,
  sectionId,
}: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-inset"
      aria-expanded={isExpanded}
      aria-controls={sectionId}
    >
      <span className="flex items-center gap-2">
        {icon}
        {title} ({count})
      </span>
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-linear-text-tertiary" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4 text-linear-text-tertiary" aria-hidden="true" />
      )}
    </button>
  );
}

// ============================================================================
// Action Buttons Component
// ============================================================================

interface ItemActionsProps {
  itemType: ExtractionType;
  hasCalendarAction?: boolean;
  onConvert: () => void;
  onDismiss: () => void;
  onAddToCalendar?: () => void;
  isConverting: boolean;
  isDismissing: boolean;
}

function ItemActions({
  itemType,
  hasCalendarAction,
  onConvert,
  onDismiss,
  onAddToCalendar,
  isConverting,
  isDismissing,
}: ItemActionsProps) {
  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        onClick={onConvert}
        disabled={isConverting}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-linear-accent text-white rounded hover:bg-linear-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-1"
        aria-label={`Convert ${itemType} to task`}
      >
        {isConverting ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-3 w-3" aria-hidden="true" />
        )}
        Create Task
      </button>
      {hasCalendarAction && onAddToCalendar && (
        <button
          onClick={onAddToCalendar}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-linear-accent text-white rounded hover:bg-linear-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-1"
          aria-label="Add to calendar"
        >
          <Calendar className="h-3 w-3" aria-hidden="true" />
          Calendar
        </button>
      )}
      <button
        onClick={onDismiss}
        disabled={isDismissing}
        className="flex items-center gap-1 px-2 py-1 text-xs text-linear-text-secondary border border-linear-border rounded hover:bg-linear-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-linear-border focus:ring-offset-1"
        aria-label={`Dismiss ${itemType}`}
      >
        {isDismissing ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <X className="h-3 w-3" aria-hidden="true" />
        )}
        Dismiss
      </button>
    </div>
  );
}

// ============================================================================
// Email Link Component
// ============================================================================

interface EmailLinkProps {
  email?: { id: string; subject: string };
}

function EmailLink({ email }: EmailLinkProps) {
  if (!email) return null;

  return (
    <a
      href={`/emails?id=${email.id}`}
      className="inline-flex items-center gap-1 text-xs text-linear-accent hover:underline focus:outline-none focus:ring-2 focus:ring-linear-accent"
      aria-label={`View source email: ${email.subject}`}
    >
      <Mail className="h-3 w-3" aria-hidden="true" />
      <span className="truncate max-w-[150px]">{email.subject}</span>
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function ExtractedItemsPanel({ caseId, onAddToCalendar }: ExtractedItemsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(
    new Set(['deadlines', 'actionItems'])
  );
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Notifications
  const { addNotification } = useNotificationStore();

  // Fetch data
  const { deadlines, commitments, actionItems, questions, loading, error, refetch } =
    usePendingExtractedItems(caseId);

  // Mutations
  const [convertToTask] = useConvertToTask();
  const [dismissExtraction] = useDismissExtraction();
  const [markQuestionAnswered] = useMarkQuestionAnswered();

  // Toggle section
  const toggleSection = useCallback((section: SectionType) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Handle convert to task
  const handleConvert = useCallback(
    async (extractionId: string, extractionType: ExtractionType) => {
      setConvertingId(extractionId);
      try {
        const result = await convertToTask({
          variables: {
            input: { extractionId, extractionType },
          },
        });
        const conversionResult = result.data?.convertExtractionToTask;
        if (conversionResult?.success) {
          addNotification({
            type: 'success',
            title: 'Task creat',
            message: 'Elementul a fost convertit într-un task cu succes.',
          });
        } else if (conversionResult?.error) {
          addNotification({
            type: 'error',
            title: 'Eroare',
            message: conversionResult.error,
          });
        }
        refetch();
      } catch (err: any) {
        console.error('Failed to convert extraction:', err);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: err.message || 'Nu s-a putut crea task-ul.',
        });
      } finally {
        setConvertingId(null);
      }
    },
    [convertToTask, refetch, addNotification]
  );

  // Handle dismiss
  const handleDismiss = useCallback(
    async (extractionId: string, extractionType: ExtractionType) => {
      const reason = prompt('Why are you dismissing this item? (Optional)');
      if (reason === null) return; // User cancelled

      setDismissingId(extractionId);
      try {
        await dismissExtraction({
          variables: {
            input: { extractionId, extractionType, reason: reason || undefined },
          },
        });
        addNotification({
          type: 'success',
          title: 'Element respins',
          message: 'Elementul a fost respins.',
        });
        refetch();
      } catch (err: any) {
        console.error('Failed to dismiss extraction:', err);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: err.message || 'Nu s-a putut respinge elementul.',
        });
      } finally {
        setDismissingId(null);
      }
    },
    [dismissExtraction, refetch, addNotification]
  );

  // Handle mark question answered
  const handleMarkAnswered = useCallback(
    async (questionId: string) => {
      try {
        await markQuestionAnswered({
          variables: { input: { questionId } },
        });
        addNotification({
          type: 'success',
          title: 'Întrebare marcată',
          message: 'Întrebarea a fost marcată ca răspunsă.',
        });
        refetch();
      } catch (err: any) {
        console.error('Failed to mark question answered:', err);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: err.message || 'Nu s-a putut marca întrebarea.',
        });
      }
    },
    [markQuestionAnswered, refetch, addNotification]
  );

  // Loading state
  if (
    loading &&
    !deadlines.length &&
    !commitments.length &&
    !actionItems.length &&
    !questions.length
  ) {
    return (
      <div className="p-4 flex items-center justify-center" role="status" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-linear-accent" aria-hidden="true" />
        <span className="ml-2 text-sm text-linear-text-secondary">Loading extracted items...</span>
      </div>
    );
  }

  // Error state - show graceful fallback instead of error
  if (error) {
    console.warn('[ExtractedItemsPanel] Failed to load:', error.message);
    return (
      <div className="p-4">
        <h3 className="font-semibold text-linear-text-primary mb-2">Elemente extrase</h3>
        <p className="text-sm text-linear-text-tertiary mb-3">Nu s-au putut încărca elementele extrase.</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-linear-accent hover:underline focus:outline-none focus:ring-2 focus:ring-linear-accent"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  const totalItems = deadlines.length + commitments.length + actionItems.length + questions.length;

  // Empty state
  if (totalItems === 0) {
    return (
      <div className="p-4 text-center text-linear-text-tertiary">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-linear-success" aria-hidden="true" />
        <p className="text-sm">Nu există elemente în așteptare</p>
        <p className="text-xs mt-1">Toate elementele au fost procesate sau respinse</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" aria-label="Extracted items panel">
      <h2 className="font-semibold text-lg">Extracted Items ({totalItems})</h2>

      {/* Deadlines Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader
          title="Deadlines"
          count={deadlines.length}
          icon={<Clock className="h-4 w-4 text-linear-warning" aria-hidden="true" />}
          isExpanded={expandedSections.has('deadlines')}
          onToggle={() => toggleSection('deadlines')}
          sectionId="deadlines-list"
        />
        {expandedSections.has('deadlines') && (
          <div
            id="deadlines-list"
            className="p-3 border-t space-y-2"
            role="list"
            aria-label="Deadlines list"
          >
            {deadlines.length === 0 ? (
              <p className="text-sm text-linear-text-tertiary">No deadlines detected</p>
            ) : (
              deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="p-3 bg-linear-warning/10 rounded-lg border border-linear-warning/30"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{deadline.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-tertiary">
                        <span>Due: {format(new Date(deadline.dueDate), 'MMM d, yyyy')}</span>
                        <ConfidenceBadge level={deadline.confidenceLevel} />
                      </div>
                      <div className="mt-1">
                        <EmailLink email={deadline.email} />
                      </div>
                    </div>
                  </div>
                  <ItemActions
                    itemType="deadline"
                    hasCalendarAction={!!onAddToCalendar}
                    onConvert={() => handleConvert(deadline.id, 'deadline')}
                    onDismiss={() => handleDismiss(deadline.id, 'deadline')}
                    onAddToCalendar={() => onAddToCalendar?.(deadline)}
                    isConverting={convertingId === deadline.id}
                    isDismissing={dismissingId === deadline.id}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Commitments Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader
          title="Commitments"
          count={commitments.length}
          icon={<ClipboardList className="h-4 w-4 text-linear-accent" aria-hidden="true" />}
          isExpanded={expandedSections.has('commitments')}
          onToggle={() => toggleSection('commitments')}
          sectionId="commitments-list"
        />
        {expandedSections.has('commitments') && (
          <div
            id="commitments-list"
            className="p-3 border-t space-y-2"
            role="list"
            aria-label="Commitments list"
          >
            {commitments.length === 0 ? (
              <p className="text-sm text-linear-text-tertiary">No commitments detected</p>
            ) : (
              commitments.map((commitment) => (
                <div
                  key={commitment.id}
                  className="p-3 bg-linear-accent/10 rounded-lg border border-linear-accent/30"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{commitment.party}</div>
                      <div className="text-sm text-linear-text-secondary mt-1">{commitment.commitmentText}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-tertiary">
                        {commitment.dueDate && (
                          <span>Due: {format(new Date(commitment.dueDate), 'MMM d, yyyy')}</span>
                        )}
                        <ConfidenceBadge level={commitment.confidenceLevel} />
                      </div>
                      <div className="mt-1">
                        <EmailLink email={commitment.email} />
                      </div>
                    </div>
                  </div>
                  <ItemActions
                    itemType="commitment"
                    hasCalendarAction={!!commitment.dueDate && !!onAddToCalendar}
                    onConvert={() => handleConvert(commitment.id, 'commitment')}
                    onDismiss={() => handleDismiss(commitment.id, 'commitment')}
                    onAddToCalendar={
                      commitment.dueDate ? () => onAddToCalendar?.(commitment) : undefined
                    }
                    isConverting={convertingId === commitment.id}
                    isDismissing={dismissingId === commitment.id}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Action Items Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader
          title="Action Items"
          count={actionItems.length}
          icon={<CheckCircle className="h-4 w-4 text-linear-success" aria-hidden="true" />}
          isExpanded={expandedSections.has('actionItems')}
          onToggle={() => toggleSection('actionItems')}
          sectionId="action-items-list"
        />
        {expandedSections.has('actionItems') && (
          <div
            id="action-items-list"
            className="p-3 border-t space-y-2"
            role="list"
            aria-label="Action items list"
          >
            {actionItems.length === 0 ? (
              <p className="text-sm text-linear-text-tertiary">No action items detected</p>
            ) : (
              actionItems.map((action) => (
                <div
                  key={action.id}
                  className="p-3 bg-linear-success/10 rounded-lg border border-linear-success/30"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{action.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-tertiary">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            action.priority === 'Urgent'
                              ? 'bg-linear-error/15 text-linear-error'
                              : action.priority === 'High'
                                ? 'bg-linear-warning/15 text-linear-warning'
                                : action.priority === 'Medium'
                                  ? 'bg-linear-warning/10 text-linear-text-secondary'
                                  : 'bg-linear-bg-tertiary text-linear-text-secondary'
                          }`}
                        >
                          {action.priority}
                        </span>
                        <ConfidenceBadge level={action.confidenceLevel} />
                      </div>
                      {action.suggestedAssignee && (
                        <div className="text-xs text-linear-text-tertiary mt-1">
                          Suggested: {action.suggestedAssignee}
                        </div>
                      )}
                      <div className="mt-1">
                        <EmailLink email={action.email} />
                      </div>
                    </div>
                  </div>
                  <ItemActions
                    itemType="actionItem"
                    onConvert={() => handleConvert(action.id, 'actionItem')}
                    onDismiss={() => handleDismiss(action.id, 'actionItem')}
                    isConverting={convertingId === action.id}
                    isDismissing={dismissingId === action.id}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Questions Section */}
      <div className="border rounded-lg overflow-hidden">
        <SectionHeader
          title="Questions"
          count={questions.length}
          icon={<HelpCircle className="h-4 w-4 text-linear-accent" aria-hidden="true" />}
          isExpanded={expandedSections.has('questions')}
          onToggle={() => toggleSection('questions')}
          sectionId="questions-list"
        />
        {expandedSections.has('questions') && (
          <div
            id="questions-list"
            className="p-3 border-t space-y-2"
            role="list"
            aria-label="Questions list"
          >
            {questions.length === 0 ? (
              <p className="text-sm text-linear-text-tertiary">No questions detected</p>
            ) : (
              questions.map((question) => (
                <div
                  key={question.id}
                  className="p-3 bg-linear-accent/10 rounded-lg border border-linear-accent/30"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{question.questionText}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-linear-text-tertiary">
                        {question.respondBy && (
                          <span className="text-linear-error">
                            Respond by: {format(new Date(question.respondBy), 'MMM d, yyyy')}
                          </span>
                        )}
                        <ConfidenceBadge level={question.confidenceLevel} />
                      </div>
                      <div className="mt-1">
                        <EmailLink email={question.email} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => handleMarkAnswered(question.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-linear-success text-white rounded hover:bg-linear-success-hover transition-colors focus:outline-none focus:ring-2 focus:ring-linear-success focus:ring-offset-1"
                      aria-label="Mark question as answered"
                    >
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      Mark Answered
                    </button>
                    <button
                      onClick={() => handleDismiss(question.id, 'question')}
                      disabled={dismissingId === question.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-linear-text-secondary border border-linear-border rounded hover:bg-linear-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-linear-border focus:ring-offset-1"
                      aria-label="Dismiss question"
                    >
                      {dismissingId === question.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="h-3 w-3" aria-hidden="true" />
                      )}
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExtractedItemsPanel;
