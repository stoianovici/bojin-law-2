'use client';

/**
 * Email Intelligence Sidebar Component
 * Story 5.2: Communication Intelligence Engine - Task 23
 *
 * Displays AI-extracted intelligence for an email thread:
 * - Extracted items (deadlines, commitments, action items, questions)
 * - Thread summary for opposing counsel threads
 *
 * Accessibility:
 * - Sidebar toggle with aria-expanded and aria-controls
 * - Skip link to bypass sidebar: "Skip to email content"
 * - Extracted items linked to highlight with aria-describedby
 */

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Brain,
  X,
  Clock,
  Users,
  HelpCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import {
  usePendingExtractedItems,
  useThreadSummary,
  type ExtractedDeadline,
  type ExtractedCommitment,
  type ExtractedActionItem,
  type ExtractedQuestion,
  type ThreadSummary,
} from '../../hooks/useExtractedItems';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface EmailIntelligenceSidebarProps {
  conversationId: string;
  caseId?: string;
  isOpen: boolean;
  onClose: () => void;
  onHighlightExtraction?: (emailId: string, extractionId: string) => void;
}

// ============================================================================
// Extracted Item Cards
// ============================================================================

interface DeadlineCardProps {
  deadline: ExtractedDeadline;
  onHighlight?: () => void;
}

function DeadlineCard({ deadline, onHighlight }: DeadlineCardProps) {
  return (
    <div
      className="p-3 bg-orange-50 rounded-lg border border-orange-200"
      aria-label={`Deadline: ${deadline.description}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gray-900">{deadline.description}</p>
            <p className="text-xs text-orange-600 mt-1">
              Due: {format(new Date(deadline.dueDate), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <ConfidenceBadge confidence={deadline.confidenceLevel} />
      </div>
      {onHighlight && (
        <button
          onClick={onHighlight}
          className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby={`deadline-${deadline.id}`}
        >
          Show in email
        </button>
      )}
    </div>
  );
}

interface CommitmentCardProps {
  commitment: ExtractedCommitment;
  onHighlight?: () => void;
}

function CommitmentCard({ commitment, onHighlight }: CommitmentCardProps) {
  return (
    <div
      className="p-3 bg-blue-50 rounded-lg border border-blue-200"
      aria-label={`Commitment by ${commitment.party}: ${commitment.commitmentText}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-blue-600 font-medium">{commitment.party}</p>
            <p className="text-sm text-gray-900 mt-1">{commitment.commitmentText}</p>
            {commitment.dueDate && (
              <p className="text-xs text-gray-500 mt-1">
                By: {format(new Date(commitment.dueDate), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
        <ConfidenceBadge confidence={commitment.confidenceLevel} />
      </div>
      {onHighlight && (
        <button
          onClick={onHighlight}
          className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Show in email
        </button>
      )}
    </div>
  );
}

interface ActionItemCardProps {
  actionItem: ExtractedActionItem;
  onHighlight?: () => void;
}

function ActionItemCard({ actionItem, onHighlight }: ActionItemCardProps) {
  return (
    <div
      className="p-3 bg-green-50 rounded-lg border border-green-200"
      aria-label={`Action item: ${actionItem.description}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <CheckSquare className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm text-gray-900">{actionItem.description}</p>
            {actionItem.suggestedAssignee && (
              <p className="text-xs text-gray-500 mt-1">
                Suggested: {actionItem.suggestedAssignee}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceBadge confidence={actionItem.confidenceLevel} />
          <PriorityBadge priority={actionItem.priority} />
        </div>
      </div>
      {onHighlight && (
        <button
          onClick={onHighlight}
          className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Show in email
        </button>
      )}
    </div>
  );
}

interface QuestionCardProps {
  question: ExtractedQuestion;
  onHighlight?: () => void;
}

function QuestionCard({ question, onHighlight }: QuestionCardProps) {
  return (
    <div
      className="p-3 bg-purple-50 rounded-lg border border-purple-200"
      aria-label={`Question: ${question.questionText}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm text-gray-900">{question.questionText}</p>
            {question.respondBy && (
              <p className="text-xs text-purple-600 mt-1">
                Respond by: {format(new Date(question.respondBy), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
        <ConfidenceBadge confidence={question.confidenceLevel} />
      </div>
      {onHighlight && (
        <button
          onClick={onHighlight}
          className="mt-2 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Show in email
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: 'Low' | 'Medium' | 'High' }) {
  const colors = {
    Low: 'bg-gray-100 text-gray-600',
    Medium: 'bg-yellow-100 text-yellow-700',
    High: 'bg-green-100 text-green-700',
  };

  return (
    <span
      className={clsx('text-xs px-1.5 py-0.5 rounded', colors[confidence])}
      aria-label={`Confidence: ${confidence}`}
    >
      {confidence}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Urgent: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={clsx('text-xs px-1.5 py-0.5 rounded', colors[priority] || colors.Low)}>
      {priority}
    </span>
  );
}

// ============================================================================
// Thread Summary Section
// ============================================================================

interface ThreadSummarySectionProps {
  summary: ThreadSummary;
}

function ThreadSummarySection({ summary }: ThreadSummarySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" aria-hidden="true" />
          <span className="font-medium text-gray-900">Thread Analysis</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Opposing Counsel Position */}
          {summary.opposingCounselPosition && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs text-purple-700 font-medium mb-1">Opposing Position</p>
              <p className="text-sm text-gray-800">{summary.opposingCounselPosition}</p>
            </div>
          )}

          {/* Key Arguments */}
          {summary.keyArguments.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">
                Key Arguments ({summary.keyArguments.length})
              </p>
              <div className="space-y-2">
                {summary.keyArguments.slice(0, 3).map((arg, i) => (
                  <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                    <span className="text-xs text-gray-500">{arg.party}:</span>
                    <p className="text-gray-800 mt-1">{arg.argument}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position Changes */}
          {summary.positionChanges.length > 0 && (
            <div className="p-2 bg-orange-50 rounded border border-orange-200">
              <p className="text-xs text-orange-700 font-medium">
                {summary.positionChanges.length} position change
                {summary.positionChanges.length !== 1 ? 's' : ''} detected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, icon, count, children, defaultExpanded = true }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (count === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {count}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
        )}
      </button>
      {isExpanded && <div className="space-y-2">{children}</div>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EmailIntelligenceSidebar({
  conversationId,
  caseId,
  isOpen,
  onClose,
  onHighlightExtraction,
}: EmailIntelligenceSidebarProps) {
  // Fetch extracted items for the case (if assigned)
  const {
    deadlines,
    commitments,
    actionItems,
    questions,
    loading: itemsLoading,
  } = usePendingExtractedItems(caseId || '');

  // Fetch thread summary
  const { data: summaryData, loading: summaryLoading } = useThreadSummary(conversationId);

  const handleHighlight = useCallback(
    (emailId: string, extractionId: string) => {
      onHighlightExtraction?.(emailId, extractionId);
    },
    [onHighlightExtraction]
  );

  // Filter items to current thread
  // In a full implementation, we would filter by emailId within the conversation
  const threadDeadlines = deadlines;
  const threadCommitments = commitments;
  const threadActionItems = actionItems;
  const threadQuestions = questions;

  const totalItems =
    threadDeadlines.length +
    threadCommitments.length +
    threadActionItems.length +
    threadQuestions.length;

  const loading = itemsLoading || summaryLoading;

  if (!isOpen) return null;

  return (
    <>
      {/* Skip link for accessibility */}
      <a
        href="#email-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg"
      >
        Skip to email content
      </a>

      {/* Sidebar */}
      <aside
        className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col h-full"
        aria-label="Email intelligence sidebar"
        role="complementary"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" aria-hidden="true" />
            <h3 className="font-semibold text-gray-900">Intelligence</h3>
            {totalItems > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close intelligence sidebar"
          >
            <X className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
            </div>
          ) : (
            <>
              {/* Thread Summary */}
              {summaryData?.threadSummary && (
                <ThreadSummarySection summary={summaryData.threadSummary} />
              )}

              {/* No items message */}
              {totalItems === 0 && !summaryData?.threadSummary && (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-gray-500">No intelligence extracted</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {caseId
                      ? 'No pending items for this thread'
                      : 'Assign to a case to see extracted items'}
                  </p>
                </div>
              )}

              {/* Deadlines */}
              <Section
                title="Deadlines"
                icon={<Clock className="h-4 w-4 text-orange-500" aria-hidden="true" />}
                count={threadDeadlines.length}
              >
                {threadDeadlines.map((deadline) => (
                  <DeadlineCard
                    key={deadline.id}
                    deadline={deadline}
                    onHighlight={() => handleHighlight(deadline.emailId, deadline.id)}
                  />
                ))}
              </Section>

              {/* Commitments */}
              <Section
                title="Commitments"
                icon={<Users className="h-4 w-4 text-blue-500" aria-hidden="true" />}
                count={threadCommitments.length}
              >
                {threadCommitments.map((commitment) => (
                  <CommitmentCard
                    key={commitment.id}
                    commitment={commitment}
                    onHighlight={() => handleHighlight(commitment.emailId, commitment.id)}
                  />
                ))}
              </Section>

              {/* Action Items */}
              <Section
                title="Action Items"
                icon={<CheckSquare className="h-4 w-4 text-green-500" aria-hidden="true" />}
                count={threadActionItems.length}
              >
                {threadActionItems.map((action) => (
                  <ActionItemCard
                    key={action.id}
                    actionItem={action}
                    onHighlight={() => handleHighlight(action.emailId, action.id)}
                  />
                ))}
              </Section>

              {/* Questions */}
              <Section
                title="Questions"
                icon={<HelpCircle className="h-4 w-4 text-purple-500" aria-hidden="true" />}
                count={threadQuestions.length}
              >
                {threadQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onHighlight={() => handleHighlight(question.emailId, question.id)}
                  />
                ))}
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        {caseId && totalItems > 0 && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <a
              href={`/cases/${caseId}?tab=intelligence`}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 text-sm text-blue-600 hover:bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View all intelligence
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

export default EmailIntelligenceSidebar;
