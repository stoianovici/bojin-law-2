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
    High: { bg: 'bg-green-100', text: 'text-green-800', label: 'High confidence' },
    Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium confidence' },
    Low: { bg: 'bg-red-100', text: 'text-red-800', label: 'Low confidence' },
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

function SectionHeader({ title, count, icon, isExpanded, onToggle, sectionId }: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
      aria-expanded={isExpanded}
      aria-controls={sectionId}
    >
      <span className="flex items-center gap-2">
        {icon}
        {title} ({count})
      </span>
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
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
        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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
          className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          aria-label="Add to calendar"
        >
          <Calendar className="h-3 w-3" aria-hidden="true" />
          Calendar
        </button>
      )}
      <button
        onClick={onDismiss}
        disabled={isDismissing}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
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
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
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
  if (loading && !deadlines.length && !commitments.length && !actionItems.length && !questions.length) {
    return (
      <div className="p-4 flex items-center justify-center" role="status" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-hidden="true" />
        <span className="ml-2 text-sm text-gray-600">Loading extracted items...</span>
      </div>
    );
  }

  // Error state - show graceful fallback instead of error
  if (error) {
    console.warn('[ExtractedItemsPanel] Failed to load:', error.message);
    return (
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Elemente extrase</h3>
        <p className="text-sm text-gray-500 mb-3">
          Nu s-au putut încărca elementele extrase.
        </p>
        <button
          onClick={() => refetch()}
          className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="p-4 text-center text-gray-500">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" aria-hidden="true" />
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
          icon={<Clock className="h-4 w-4 text-orange-500" aria-hidden="true" />}
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
              <p className="text-sm text-gray-500">No deadlines detected</p>
            ) : (
              deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="p-3 bg-orange-50 rounded-lg border border-orange-100"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{deadline.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
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
          icon={<ClipboardList className="h-4 w-4 text-blue-500" aria-hidden="true" />}
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
              <p className="text-sm text-gray-500">No commitments detected</p>
            ) : (
              commitments.map((commitment) => (
                <div
                  key={commitment.id}
                  className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{commitment.party}</div>
                      <div className="text-sm text-gray-700 mt-1">{commitment.commitmentText}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
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
          icon={<CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />}
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
              <p className="text-sm text-gray-500">No action items detected</p>
            ) : (
              actionItems.map((action) => (
                <div
                  key={action.id}
                  className="p-3 bg-green-50 rounded-lg border border-green-100"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{action.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            action.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800'
                              : action.priority === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : action.priority === 'Medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {action.priority}
                        </span>
                        <ConfidenceBadge level={action.confidenceLevel} />
                      </div>
                      {action.suggestedAssignee && (
                        <div className="text-xs text-gray-600 mt-1">
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
          icon={<HelpCircle className="h-4 w-4 text-purple-500" aria-hidden="true" />}
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
              <p className="text-sm text-gray-500">No questions detected</p>
            ) : (
              questions.map((question) => (
                <div
                  key={question.id}
                  className="p-3 bg-purple-50 rounded-lg border border-purple-100"
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{question.questionText}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                        {question.respondBy && (
                          <span className="text-red-600">
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
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                      aria-label="Mark question as answered"
                    >
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      Mark Answered
                    </button>
                    <button
                      onClick={() => handleDismiss(question.id, 'question')}
                      disabled={dismissingId === question.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
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
