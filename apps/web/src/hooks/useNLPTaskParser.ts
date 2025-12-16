/**
 * useNLPTaskParser Hooks
 * Story 4.1: Natural Language Task Parser - Task 9
 *
 * React hooks for parsing natural language task input using AI.
 * Provides debounced parsing, clarification handling, and pattern suggestions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import type {
  NLPTaskParseResponse,
  TaskCorrections,
  TaskPatternSuggestion,
  ClarificationQuestion,
  ParsedTaskFields,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface ParseTaskData {
  parseTask: NLPTaskParseResponse;
}

interface ResolveClarificationData {
  resolveClarification: NLPTaskParseResponse;
}

interface ConfirmTaskCreationData {
  confirmTaskCreation: {
    id: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority: string;
    status: string;
    taskType: string;
    case?: {
      id: string;
      caseNumber: string;
      title: string;
    };
    assignee?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
}

interface RecordParsedTaskData {
  recordParsedTask: boolean;
}

interface TaskPatternSuggestionsData {
  taskPatternSuggestions: TaskPatternSuggestion[];
}

// ============================================================================
// GraphQL Operations
// ============================================================================

const PARSE_TASK_MUTATION = gql`
  mutation ParseTask($input: String!, $context: TaskParseContextInput) {
    parseTask(input: $input, context: $context) {
      parseId
      originalText
      detectedLanguage
      parsedTask {
        taskType {
          value
          confidence
        }
        title {
          value
          confidence
        }
        description {
          value
          confidence
        }
        dueDate {
          value
          confidence
        }
        dueTime {
          value
          confidence
        }
        priority {
          value
          confidence
        }
        assigneeName {
          value
          confidence
        }
        assigneeId {
          value
          confidence
        }
        caseReference {
          value
          confidence
        }
        caseId {
          value
          confidence
        }
      }
      entities {
        type
        value
        normalizedValue
        startIndex
        endIndex
        confidence
      }
      overallConfidence
      clarificationsNeeded {
        id
        entityType
        question
        options {
          value
          label
          context
        }
        allowFreeText
      }
      isComplete
    }
  }
`;

const RESOLVE_CLARIFICATION_MUTATION = gql`
  mutation ResolveClarification($parseId: ID!, $questionId: ID!, $answer: String!) {
    resolveClarification(parseId: $parseId, questionId: $questionId, answer: $answer) {
      parseId
      originalText
      detectedLanguage
      parsedTask {
        taskType {
          value
          confidence
        }
        title {
          value
          confidence
        }
        description {
          value
          confidence
        }
        dueDate {
          value
          confidence
        }
        dueTime {
          value
          confidence
        }
        priority {
          value
          confidence
        }
        assigneeName {
          value
          confidence
        }
        assigneeId {
          value
          confidence
        }
        caseReference {
          value
          confidence
        }
        caseId {
          value
          confidence
        }
      }
      entities {
        type
        value
        normalizedValue
        startIndex
        endIndex
        confidence
      }
      overallConfidence
      clarificationsNeeded {
        id
        entityType
        question
        options {
          value
          label
          context
        }
        allowFreeText
      }
      isComplete
    }
  }
`;

const CONFIRM_TASK_CREATION_MUTATION = gql`
  mutation ConfirmTaskCreation($parseId: ID!, $corrections: TaskCorrectionInput) {
    confirmTaskCreation(parseId: $parseId, corrections: $corrections) {
      id
      title
      description
      dueDate
      priority
      status
      taskType
      case {
        id
        caseNumber
        title
      }
      assignee {
        id
        firstName
        lastName
      }
    }
  }
`;

const RECORD_PARSED_TASK_MUTATION = gql`
  mutation RecordParsedTask(
    $parseId: ID!
    $wasAccepted: Boolean!
    $corrections: TaskCorrectionInput
    $finalTaskId: ID
  ) {
    recordParsedTask(
      parseId: $parseId
      wasAccepted: $wasAccepted
      corrections: $corrections
      finalTaskId: $finalTaskId
    )
  }
`;

const TASK_PATTERN_SUGGESTIONS_QUERY = gql`
  query TaskPatternSuggestions($partialInput: String!) {
    taskPatternSuggestions(partialInput: $partialInput) {
      id
      pattern
      completedText
      taskType
      frequency
      lastUsed
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface TaskParseContext {
  activeCaseIds?: string[];
  teamMemberNames?: string[];
  recentTaskPatterns?: string[];
}

export interface UseNLPTaskParserOptions {
  /** Context for parsing (active cases, team members) */
  context?: TaskParseContext;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** Minimum characters before parsing (default: 10) */
  minCharsForParse?: number;
  /** Auto-parse as user types (default: true) */
  autoParse?: boolean;
  /** Callback when parsing starts */
  onParseStart?: () => void;
  /** Callback when parsing completes */
  onParseComplete?: (result: NLPTaskParseResponse) => void;
  /** Callback when parsing fails */
  onParseError?: (error: Error) => void;
}

export interface UseNLPTaskParserReturn {
  // State
  inputText: string;
  parseResult: NLPTaskParseResponse | null;
  isLoading: boolean;
  error: Error | null;
  suggestions: TaskPatternSuggestion[];

  // Actions
  setInputText: (text: string) => void;
  parseInput: (text?: string) => Promise<NLPTaskParseResponse | null>;
  resolveClarification: (
    questionId: string,
    answer: string
  ) => Promise<NLPTaskParseResponse | null>;
  confirmTask: (corrections?: TaskCorrections) => Promise<any>;
  recordResult: (
    wasAccepted: boolean,
    corrections?: TaskCorrections,
    taskId?: string
  ) => Promise<void>;
  reset: () => void;

  // Computed
  needsClarification: boolean;
  currentClarification: ClarificationQuestion | null;
  confidenceLevel: 'high' | 'medium' | 'low';
  parsedFields: ParsedTaskFields | null;
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
};

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for parsing natural language task input with AI
 *
 * @example
 * ```tsx
 * function TaskCreator() {
 *   const {
 *     inputText,
 *     setInputText,
 *     parseResult,
 *     isLoading,
 *     needsClarification,
 *     currentClarification,
 *     resolveClarification,
 *     confirmTask,
 *   } = useNLPTaskParser({
 *     context: {
 *       activeCaseIds: ['case-123'],
 *       teamMemberNames: ['Ion Popescu', 'Maria Ionescu'],
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         value={inputText}
 *         onChange={(e) => setInputText(e.target.value)}
 *         placeholder="Descrie sarcina ta..."
 *       />
 *       {isLoading && <Spinner />}
 *       {parseResult && <TaskPreview fields={parseResult.parsedTask} />}
 *       {needsClarification && (
 *         <ClarificationDialog
 *           question={currentClarification}
 *           onAnswer={(answer) => resolveClarification(currentClarification.id, answer)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNLPTaskParser(options: UseNLPTaskParserOptions = {}): UseNLPTaskParserReturn {
  const {
    context,
    debounceMs = 500,
    minCharsForParse = 10,
    autoParse = true,
    onParseStart,
    onParseComplete,
    onParseError,
  } = options;

  // State
  const [inputText, setInputTextState] = useState('');
  const [parseResult, setParseResult] = useState<NLPTaskParseResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<TaskPatternSuggestion[]>([]);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastParsedTextRef = useRef<string>('');

  // GraphQL mutations
  const [parseTaskMutation, { loading: parseLoading }] =
    useMutation<ParseTaskData>(PARSE_TASK_MUTATION);
  const [resolveClarificationMutation, { loading: clarifyLoading }] =
    useMutation<ResolveClarificationData>(RESOLVE_CLARIFICATION_MUTATION);
  const [confirmTaskMutation] = useMutation<ConfirmTaskCreationData>(
    CONFIRM_TASK_CREATION_MUTATION
  );
  const [recordParsedTaskMutation] = useMutation<RecordParsedTaskData>(RECORD_PARSED_TASK_MUTATION);

  // Pattern suggestions query (lazy)
  const [fetchSuggestionsQuery] = useLazyQuery<TaskPatternSuggestionsData>(
    TASK_PATTERN_SUGGESTIONS_QUERY,
    {
      fetchPolicy: 'network-only',
    }
  );

  // Wrapper for fetchSuggestions that handles the response
  const fetchSuggestions = useCallback(
    async (variables: { partialInput: string }) => {
      const result = await fetchSuggestionsQuery({ variables });
      if (result.data?.taskPatternSuggestions) {
        setSuggestions(result.data.taskPatternSuggestions);
      }
    },
    [fetchSuggestionsQuery]
  );

  const isLoading = parseLoading || clarifyLoading;

  // Parse the input text
  const parseInput = useCallback(
    async (text?: string): Promise<NLPTaskParseResponse | null> => {
      const textToParse = text ?? inputText;

      if (textToParse.length < minCharsForParse) {
        return null;
      }

      // Don't re-parse the same text
      if (textToParse === lastParsedTextRef.current && parseResult) {
        return parseResult;
      }

      try {
        setError(null);
        onParseStart?.();

        const { data } = await parseTaskMutation({
          variables: {
            input: textToParse,
            context: context
              ? {
                  activeCaseIds: context.activeCaseIds,
                  teamMemberNames: context.teamMemberNames,
                  recentTaskPatterns: context.recentTaskPatterns,
                }
              : undefined,
          },
        });

        if (data?.parseTask) {
          lastParsedTextRef.current = textToParse;
          setParseResult(data.parseTask);
          onParseComplete?.(data.parseTask);
          return data.parseTask;
        }

        return null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Parse failed');
        setError(error);
        onParseError?.(error);
        return null;
      }
    },
    [
      inputText,
      minCharsForParse,
      parseResult,
      parseTaskMutation,
      context,
      onParseStart,
      onParseComplete,
      onParseError,
    ]
  );

  // Handle input text changes with debouncing
  const setInputText = useCallback(
    (text: string) => {
      setInputTextState(text);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Fetch suggestions for short input
      if (text.length >= 3 && text.length < minCharsForParse) {
        fetchSuggestions({ partialInput: text });
      } else {
        setSuggestions([]);
      }

      // Set up debounced parsing
      if (autoParse && text.length >= minCharsForParse) {
        debounceTimerRef.current = setTimeout(() => {
          parseInput(text);
        }, debounceMs);
      }
    },
    [autoParse, debounceMs, minCharsForParse, parseInput, fetchSuggestions]
  );

  // Resolve a clarification question
  const resolveClarification = useCallback(
    async (questionId: string, answer: string): Promise<NLPTaskParseResponse | null> => {
      if (!parseResult?.parseId) {
        return null;
      }

      try {
        setError(null);

        const { data } = await resolveClarificationMutation({
          variables: {
            parseId: parseResult.parseId,
            questionId,
            answer,
          },
        });

        if (data?.resolveClarification) {
          setParseResult(data.resolveClarification);
          return data.resolveClarification;
        }

        return null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Clarification failed');
        setError(error);
        return null;
      }
    },
    [parseResult?.parseId, resolveClarificationMutation]
  );

  // Confirm task creation
  const confirmTask = useCallback(
    async (corrections?: TaskCorrections) => {
      if (!parseResult?.parseId) {
        throw new Error('No parse result to confirm');
      }

      try {
        const { data } = await confirmTaskMutation({
          variables: {
            parseId: parseResult.parseId,
            corrections: corrections
              ? {
                  taskType: corrections.taskType,
                  title: corrections.title,
                  description: corrections.description,
                  dueDate: corrections.dueDate,
                  dueTime: corrections.dueTime,
                  priority: corrections.priority,
                  assigneeId: corrections.assigneeId,
                  caseId: corrections.caseId,
                }
              : undefined,
          },
        });

        // Record for pattern learning
        if (data?.confirmTaskCreation?.id) {
          await recordParsedTaskMutation({
            variables: {
              parseId: parseResult.parseId,
              wasAccepted: true,
              corrections,
              finalTaskId: data.confirmTaskCreation.id,
            },
          });
        }

        return data?.confirmTaskCreation;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Task creation failed');
        setError(error);
        throw error;
      }
    },
    [parseResult?.parseId, confirmTaskMutation, recordParsedTaskMutation]
  );

  // Record parse result for learning
  const recordResult = useCallback(
    async (wasAccepted: boolean, corrections?: TaskCorrections, taskId?: string) => {
      if (!parseResult?.parseId) {
        return;
      }

      try {
        await recordParsedTaskMutation({
          variables: {
            parseId: parseResult.parseId,
            wasAccepted,
            corrections,
            finalTaskId: taskId,
          },
        });
      } catch (err) {
        // Don't throw - recording is optional
        console.error('Failed to record parse result:', err);
      }
    },
    [parseResult?.parseId, recordParsedTaskMutation]
  );

  // Reset state
  const reset = useCallback(() => {
    setInputTextState('');
    setParseResult(null);
    setError(null);
    setSuggestions([]);
    lastParsedTextRef.current = '';

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Computed values
  const needsClarification = (parseResult?.clarificationsNeeded?.length ?? 0) > 0;
  const currentClarification = needsClarification ? parseResult!.clarificationsNeeded[0] : null;
  const confidenceLevel = getConfidenceLevel(parseResult?.overallConfidence ?? 0);
  const parsedFields = parseResult?.parsedTask ?? null;

  return {
    // State
    inputText,
    parseResult,
    isLoading,
    error,
    suggestions,

    // Actions
    setInputText,
    parseInput,
    resolveClarification,
    confirmTask,
    recordResult,
    reset,

    // Computed
    needsClarification,
    currentClarification,
    confidenceLevel,
    parsedFields,
  };
}

// ============================================================================
// Pattern Suggestions Hook
// ============================================================================

/**
 * Hook for fetching pattern suggestions as user types
 *
 * @example
 * ```tsx
 * function TaskInput() {
 *   const { suggestions, isLoading, fetchSuggestions } = useTaskPatternSuggestions();
 *
 *   return (
 *     <Combobox>
 *       <ComboboxInput onChange={(e) => fetchSuggestions(e.target.value)} />
 *       <ComboboxList>
 *         {suggestions.map((s) => (
 *           <ComboboxOption key={s.id} value={s.completedText}>
 *             {s.pattern}
 *           </ComboboxOption>
 *         ))}
 *       </ComboboxList>
 *     </Combobox>
 *   );
 * }
 * ```
 */
export function useTaskPatternSuggestions() {
  const [suggestions, setSuggestions] = useState<TaskPatternSuggestion[]>([]);

  const [fetchQuery, { loading }] = useLazyQuery<TaskPatternSuggestionsData>(
    TASK_PATTERN_SUGGESTIONS_QUERY,
    {
      fetchPolicy: 'network-only',
    }
  );

  const fetchSuggestions = useCallback(
    async (partialInput: string) => {
      if (partialInput.length < 3) {
        setSuggestions([]);
        return;
      }

      const result = await fetchQuery({ variables: { partialInput } });
      if (result.data?.taskPatternSuggestions) {
        setSuggestions(result.data.taskPatternSuggestions);
      }
    },
    [fetchQuery]
  );

  const clear = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading: loading,
    fetchSuggestions,
    clear,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useNLPTaskParser;
