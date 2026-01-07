/**
 * Extracted Items React Hooks
 * Story 5.2: Communication Intelligence Engine
 *
 * Hooks for fetching and managing AI-extracted items from emails:
 * - Deadlines
 * - Commitments
 * - Action Items
 * - Questions
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import type { TaskPriority } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export type ExtractionStatus = 'Pending' | 'Converted' | 'Dismissed' | 'Expired';
export type ExtractionConfidence = 'Low' | 'Medium' | 'High';
export type ExtractionType = 'deadline' | 'commitment' | 'actionItem' | 'question';

export interface ExtractedDeadline {
  id: string;
  emailId: string;
  caseId: string | null;
  description: string;
  dueDate: string;
  confidence: number;
  confidenceLevel: ExtractionConfidence;
  status: ExtractionStatus;
  convertedTaskId: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
  email?: { id: string; subject: string };
  case?: { id: string; title: string };
  convertedTask?: { id: string; title: string };
}

export interface ExtractedCommitment {
  id: string;
  emailId: string;
  caseId: string | null;
  party: string;
  commitmentText: string;
  dueDate: string | null;
  confidence: number;
  confidenceLevel: ExtractionConfidence;
  status: ExtractionStatus;
  convertedTaskId: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
  email?: { id: string; subject: string };
  case?: { id: string; title: string };
  convertedTask?: { id: string; title: string };
}

export interface ExtractedActionItem {
  id: string;
  emailId: string;
  caseId: string | null;
  description: string;
  suggestedAssignee: string | null;
  priority: TaskPriority;
  confidence: number;
  confidenceLevel: ExtractionConfidence;
  status: ExtractionStatus;
  convertedTaskId: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
  email?: { id: string; subject: string };
  case?: { id: string; title: string };
  convertedTask?: { id: string; title: string };
}

export interface ExtractedQuestion {
  id: string;
  emailId: string;
  caseId: string | null;
  questionText: string;
  respondBy: string | null;
  confidence: number;
  confidenceLevel: ExtractionConfidence;
  status: ExtractionStatus;
  isAnswered: boolean;
  answeredAt: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
  email?: { id: string; subject: string };
  case?: { id: string; title: string };
}

export interface ExtractedItemsFilter {
  caseId?: string;
  emailId?: string;
  status?: ExtractionStatus;
  minConfidence?: number;
  fromDate?: string;
  toDate?: string;
}

export interface ConversionSuggestion {
  title: string;
  description: string;
  suggestedAssignee: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  taskType: string;
  caseId: string | null;
  sourceEmailId: string;
}

export interface ConversionResult {
  success: boolean;
  taskId: string | null;
  error: string | null;
}

// ============================================================================
// GraphQL Fragments
// ============================================================================

const EXTRACTED_DEADLINE_FRAGMENT = gql`
  fragment ExtractedDeadlineFields on ExtractedDeadline {
    id
    emailId
    caseId
    description
    dueDate
    confidence
    confidenceLevel
    status
    convertedTaskId
    dismissedAt
    dismissReason
    createdAt
    email {
      id
      subject
    }
    case {
      id
      title
    }
    convertedTask {
      id
      title
    }
  }
`;

const EXTRACTED_COMMITMENT_FRAGMENT = gql`
  fragment ExtractedCommitmentFields on ExtractedCommitment {
    id
    emailId
    caseId
    party
    commitmentText
    dueDate
    confidence
    confidenceLevel
    status
    convertedTaskId
    dismissedAt
    dismissReason
    createdAt
    email {
      id
      subject
    }
    case {
      id
      title
    }
    convertedTask {
      id
      title
    }
  }
`;

const EXTRACTED_ACTION_ITEM_FRAGMENT = gql`
  fragment ExtractedActionItemFields on ExtractedActionItem {
    id
    emailId
    caseId
    description
    suggestedAssignee
    priority
    confidence
    confidenceLevel
    status
    convertedTaskId
    dismissedAt
    dismissReason
    createdAt
    email {
      id
      subject
    }
    case {
      id
      title
    }
    convertedTask {
      id
      title
    }
  }
`;

const EXTRACTED_QUESTION_FRAGMENT = gql`
  fragment ExtractedQuestionFields on ExtractedQuestion {
    id
    emailId
    caseId
    questionText
    respondBy
    confidence
    confidenceLevel
    status
    isAnswered
    answeredAt
    dismissedAt
    dismissReason
    createdAt
    email {
      id
      subject
    }
    case {
      id
      title
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_EXTRACTED_DEADLINES = gql`
  ${EXTRACTED_DEADLINE_FRAGMENT}
  query GetExtractedDeadlines($filter: ExtractedItemsFilter) {
    extractedDeadlines(filter: $filter) {
      ...ExtractedDeadlineFields
    }
  }
`;

const GET_EXTRACTED_COMMITMENTS = gql`
  ${EXTRACTED_COMMITMENT_FRAGMENT}
  query GetExtractedCommitments($filter: ExtractedItemsFilter) {
    extractedCommitments(filter: $filter) {
      ...ExtractedCommitmentFields
    }
  }
`;

const GET_EXTRACTED_ACTION_ITEMS = gql`
  ${EXTRACTED_ACTION_ITEM_FRAGMENT}
  query GetExtractedActionItems($filter: ExtractedItemsFilter) {
    extractedActionItems(filter: $filter) {
      ...ExtractedActionItemFields
    }
  }
`;

const GET_EXTRACTED_QUESTIONS = gql`
  ${EXTRACTED_QUESTION_FRAGMENT}
  query GetExtractedQuestions($filter: ExtractedItemsFilter) {
    extractedQuestions(filter: $filter) {
      ...ExtractedQuestionFields
    }
  }
`;

const GET_CONVERSION_SUGGESTION = gql`
  query GetConversionSuggestion($extractionId: ID!, $extractionType: ExtractionType!) {
    conversionSuggestion(extractionId: $extractionId, extractionType: $extractionType) {
      title
      description
      suggestedAssignee
      dueDate
      priority
      taskType
      caseId
      sourceEmailId
    }
  }
`;

const GET_EXTRACTED_ITEMS_COUNTS = gql`
  query GetExtractedItemsCounts($caseId: ID!) {
    extractedItemsCounts(caseId: $caseId) {
      deadlines
      commitments
      actionItems
      questions
      total
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CONVERT_EXTRACTION_TO_TASK = gql`
  mutation ConvertExtractionToTask($input: ConvertToTaskInput!) {
    convertExtractionToTask(input: $input) {
      success
      taskId
      error
    }
  }
`;

const DISMISS_EXTRACTION = gql`
  mutation DismissExtraction($input: DismissExtractionInput!) {
    dismissExtraction(input: $input)
  }
`;

const MARK_QUESTION_ANSWERED = gql`
  ${EXTRACTED_QUESTION_FRAGMENT}
  mutation MarkQuestionAnswered($input: MarkQuestionAnsweredInput!) {
    markQuestionAnswered(input: $input) {
      ...ExtractedQuestionFields
    }
  }
`;

// ============================================================================
// Custom Hooks - Queries
// ============================================================================

/**
 * Hook to fetch extracted deadlines with optional filters
 */
export function useExtractedDeadlines(filter?: ExtractedItemsFilter) {
  return useQuery<{ extractedDeadlines: ExtractedDeadline[] }>(GET_EXTRACTED_DEADLINES, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch extracted commitments with optional filters
 */
export function useExtractedCommitments(filter?: ExtractedItemsFilter) {
  return useQuery<{ extractedCommitments: ExtractedCommitment[] }>(GET_EXTRACTED_COMMITMENTS, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch extracted action items with optional filters
 */
export function useExtractedActionItems(filter?: ExtractedItemsFilter) {
  return useQuery<{ extractedActionItems: ExtractedActionItem[] }>(GET_EXTRACTED_ACTION_ITEMS, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch extracted questions with optional filters
 */
export function useExtractedQuestions(filter?: ExtractedItemsFilter) {
  return useQuery<{ extractedQuestions: ExtractedQuestion[] }>(GET_EXTRACTED_QUESTIONS, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch conversion suggestion for an extraction
 */
export function useConversionSuggestion(extractionId: string, extractionType: ExtractionType) {
  return useQuery<{ conversionSuggestion: ConversionSuggestion | null }>(
    GET_CONVERSION_SUGGESTION,
    {
      variables: { extractionId, extractionType },
      skip: !extractionId,
    }
  );
}

/**
 * Hook to fetch extracted items counts for a case
 */
export function useExtractedItemsCounts(caseId: string) {
  return useQuery<{
    extractedItemsCounts: {
      deadlines: number;
      commitments: number;
      actionItems: number;
      questions: number;
      total: number;
    };
  }>(GET_EXTRACTED_ITEMS_COUNTS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch all pending extracted items for a case
 * Combines all item types in a single call pattern
 */
export function usePendingExtractedItems(caseId: string) {
  const filter: ExtractedItemsFilter = { caseId, status: 'Pending' };

  const deadlines = useExtractedDeadlines(filter);
  const commitments = useExtractedCommitments(filter);
  const actionItems = useExtractedActionItems(filter);
  const questions = useExtractedQuestions(filter);

  const loading =
    deadlines.loading || commitments.loading || actionItems.loading || questions.loading;
  const error = deadlines.error || commitments.error || actionItems.error || questions.error;

  return {
    deadlines: deadlines.data?.extractedDeadlines ?? [],
    commitments: commitments.data?.extractedCommitments ?? [],
    actionItems: actionItems.data?.extractedActionItems ?? [],
    questions: questions.data?.extractedQuestions ?? [],
    loading,
    error,
    refetch: () => {
      deadlines.refetch();
      commitments.refetch();
      actionItems.refetch();
      questions.refetch();
    },
  };
}

// ============================================================================
// Custom Hooks - Mutations
// ============================================================================

export interface ConvertToTaskInput {
  extractionId: string;
  extractionType: ExtractionType;
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: TaskPriority;
  taskType?: string;
}

/**
 * Hook to convert an extraction to a task
 */
export function useConvertToTask() {
  return useMutation<{ convertExtractionToTask: ConversionResult }, { input: ConvertToTaskInput }>(
    CONVERT_EXTRACTION_TO_TASK,
    {
      refetchQueries: [
        'GetExtractedDeadlines',
        'GetExtractedCommitments',
        'GetExtractedActionItems',
        'GetExtractedItemsCounts',
        'GetMyTasks',
        'GetTasksByCase',
      ],
    }
  );
}

export interface DismissExtractionInput {
  extractionId: string;
  extractionType: ExtractionType;
  reason?: string;
}

/**
 * Hook to dismiss an extraction
 */
export function useDismissExtraction() {
  return useMutation<{ dismissExtraction: boolean }, { input: DismissExtractionInput }>(
    DISMISS_EXTRACTION,
    {
      refetchQueries: [
        'GetExtractedDeadlines',
        'GetExtractedCommitments',
        'GetExtractedActionItems',
        'GetExtractedQuestions',
        'GetExtractedItemsCounts',
      ],
    }
  );
}

/**
 * Hook to mark a question as answered
 */
export function useMarkQuestionAnswered() {
  return useMutation<
    { markQuestionAnswered: ExtractedQuestion },
    { input: { questionId: string } }
  >(MARK_QUESTION_ANSWERED, {
    refetchQueries: ['GetExtractedQuestions', 'GetExtractedItemsCounts'],
  });
}

// ============================================================================
// Calendar Suggestions
// ============================================================================

export interface CalendarSuggestion {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  isAllDay: boolean;
  description: string;
  caseId: string | null;
  sourceExtractionId: string;
  sourceType: 'deadline' | 'commitment' | 'meeting';
  reminderMinutes: number[];
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
}

const GET_CALENDAR_SUGGESTIONS = gql`
  query GetCalendarSuggestions($caseId: ID!) {
    calendarSuggestions(caseId: $caseId) {
      id
      title
      startDateTime
      endDateTime
      isAllDay
      description
      caseId
      sourceExtractionId
      sourceType
      reminderMinutes
      priority
    }
  }
`;

const CREATE_CALENDAR_EVENT = gql`
  mutation CreateCalendarEvent($suggestionId: ID!) {
    createCalendarEvent(suggestionId: $suggestionId) {
      success
      eventId
      error
    }
  }
`;

/**
 * Hook to fetch calendar suggestions for a case
 */
export function useCalendarSuggestions(caseId: string) {
  return useQuery<{ calendarSuggestions: CalendarSuggestion[] }>(GET_CALENDAR_SUGGESTIONS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to create a calendar event from a suggestion
 */
export function useCreateCalendarEvent() {
  return useMutation<
    { createCalendarEvent: { success: boolean; eventId: string | null; error: string | null } },
    { suggestionId: string }
  >(CREATE_CALENDAR_EVENT, {
    refetchQueries: ['GetCalendarSuggestions', 'GetExtractedDeadlines', 'GetExtractedCommitments'],
  });
}

// ============================================================================
// Thread Summary
// ============================================================================

export interface KeyArgument {
  party: string;
  argument: string;
  evidence: string | null;
  date: string;
  emailId: string;
}

export interface PositionChange {
  date: string;
  previousPosition: string;
  newPosition: string;
  trigger: string | null;
  emailId: string;
}

export interface ThreadSummary {
  id: string;
  conversationId: string;
  caseId: string | null;
  opposingCounselPosition: string | null;
  keyArguments: KeyArgument[];
  positionChanges: PositionChange[];
  lastAnalyzedAt: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; title: string };
}

const THREAD_SUMMARY_FRAGMENT = gql`
  fragment ThreadSummaryFields on ThreadSummary {
    id
    conversationId
    caseId
    opposingCounselPosition
    keyArguments {
      party
      argument
      evidence
      date
      emailId
    }
    positionChanges {
      date
      previousPosition
      newPosition
      trigger
      emailId
    }
    lastAnalyzedAt
    messageCount
    createdAt
    updatedAt
    case {
      id
      title
    }
  }
`;

const GET_THREAD_SUMMARY = gql`
  ${THREAD_SUMMARY_FRAGMENT}
  query GetThreadSummary($conversationId: String!) {
    threadSummary(conversationId: $conversationId) {
      ...ThreadSummaryFields
    }
  }
`;

const GET_CASE_THREAD_SUMMARIES = gql`
  ${THREAD_SUMMARY_FRAGMENT}
  query GetCaseThreadSummaries($caseId: ID!) {
    caseThreadSummaries(caseId: $caseId) {
      ...ThreadSummaryFields
    }
  }
`;

const TRIGGER_THREAD_ANALYSIS = gql`
  ${THREAD_SUMMARY_FRAGMENT}
  mutation TriggerThreadAnalysis($conversationId: String!) {
    triggerThreadAnalysis(conversationId: $conversationId) {
      ...ThreadSummaryFields
    }
  }
`;

/**
 * Hook to fetch a thread summary by conversation ID
 */
export function useThreadSummary(conversationId: string) {
  return useQuery<{ threadSummary: ThreadSummary | null }>(GET_THREAD_SUMMARY, {
    variables: { conversationId },
    skip: !conversationId,
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch all thread summaries for a case
 */
export function useCaseThreadSummaries(caseId: string) {
  return useQuery<{ caseThreadSummaries: ThreadSummary[] }>(GET_CASE_THREAD_SUMMARIES, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to trigger thread analysis (reanalyze)
 */
export function useTriggerThreadAnalysis() {
  return useMutation<{ triggerThreadAnalysis: ThreadSummary | null }, { conversationId: string }>(
    TRIGGER_THREAD_ANALYSIS,
    {
      refetchQueries: ['GetThreadSummary', 'GetCaseThreadSummaries'],
    }
  );
}
