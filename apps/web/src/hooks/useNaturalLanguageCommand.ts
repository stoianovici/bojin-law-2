/**
 * Natural Language Command Hook
 * Story 1.5: QuickActionsBar AI Processing
 *
 * Provides hook for processing natural language commands via AI
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useCallback, useState } from 'react';

// ============================================================================
// GraphQL Mutations
// ============================================================================

const PROCESS_NATURAL_LANGUAGE_COMMAND = gql`
  mutation ProcessNaturalLanguageCommand($input: ProcessCommandInput!) {
    processNaturalLanguageCommand(input: $input) {
      success
      status
      intent
      confidence
      message
      entityId
      entityType
      extractedParams {
        title
        description
        dueDate
        dueTime
        priority
        taskType
        durationMinutes
        recipientEmail
        documentType
      }
      suggestedActions {
        type
        label
        params
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type CommandIntent =
  | 'CREATE_TASK'
  | 'ADD_DOCUMENT'
  | 'SCHEDULE_DEADLINE'
  | 'EMAIL_CLIENT'
  | 'LOG_TIME'
  | 'SEARCH'
  | 'GENERATE_DOCUMENT'
  | 'SUMMARIZE'
  | 'FILTER'
  | 'CREATE_REMINDER'
  | 'UNKNOWN';

export type AIAssistantSection =
  | 'dashboard'
  | 'case'
  | 'communications'
  | 'documents'
  | 'tasks'
  | 'clients'
  | 'calendar'
  | 'analytics'
  | 'admin'
  | 'settings';

export type CommandStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CLARIFICATION_NEEDED';

export interface CommandParams {
  title?: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  taskType?: string;
  durationMinutes?: number;
  recipientEmail?: string;
  documentType?: string;
}

export interface SuggestedAction {
  type: string;
  label: string;
  params?: Record<string, unknown>;
}

export interface NaturalLanguageCommandResult {
  success: boolean;
  status: CommandStatus;
  intent: CommandIntent;
  confidence: number;
  message: string;
  entityId?: string;
  entityType?: string;
  extractedParams?: CommandParams;
  suggestedActions?: SuggestedAction[];
}

export interface ProcessCommandInput {
  input: string;
  caseId?: string;
  section?: AIAssistantSection;
  preselectedIntent?: CommandIntent;
}

interface ProcessNaturalLanguageCommandResponse {
  processNaturalLanguageCommand: NaturalLanguageCommandResult;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for processing natural language commands
 *
 * @param caseId - Optional case ID for case context
 * @param section - Current section for context-aware suggestions
 * @returns Command processing functions and state
 */
export function useNaturalLanguageCommand(caseId?: string, section?: AIAssistantSection) {
  const [result, setResult] = useState<NaturalLanguageCommandResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [processCommand, { loading, error }] = useMutation<ProcessNaturalLanguageCommandResponse>(
    PROCESS_NATURAL_LANGUAGE_COMMAND
  );

  /**
   * Process a natural language command
   */
  const executeCommand = useCallback(
    async (
      input: string,
      preselectedIntent?: CommandIntent
    ): Promise<NaturalLanguageCommandResult | null> => {
      if (!input.trim()) {
        return null;
      }

      setIsProcessing(true);
      setResult(null);

      try {
        const response = await processCommand({
          variables: {
            input: {
              input: input.trim(),
              caseId: caseId || undefined,
              section: section || 'dashboard',
              preselectedIntent,
            },
          },
        });

        const commandResult = response.data
          ?.processNaturalLanguageCommand as NaturalLanguageCommandResult;

        setResult(commandResult);
        return commandResult;
      } catch (err) {
        console.error('[useNaturalLanguageCommand] Error:', err);
        const errorResult: NaturalLanguageCommandResult = {
          success: false,
          status: 'FAILED',
          intent: 'UNKNOWN',
          confidence: 0,
          message: err instanceof Error ? err.message : 'A apărut o eroare la procesarea comenzii.',
        };
        setResult(errorResult);
        return errorResult;
      } finally {
        setIsProcessing(false);
      }
    },
    [caseId, section, processCommand]
  );

  /**
   * Process a quick action chip click (preselected intent)
   */
  const executeQuickAction = useCallback(
    async (
      intent: CommandIntent,
      additionalText?: string
    ): Promise<NaturalLanguageCommandResult | null> => {
      const intentLabels: Record<CommandIntent, string> = {
        CREATE_TASK: 'Creează sarcină',
        ADD_DOCUMENT: 'Adaugă document',
        SCHEDULE_DEADLINE: 'Programează termen',
        EMAIL_CLIENT: 'Email client',
        LOG_TIME: 'Înregistrează timp',
        SEARCH: 'Caută',
        GENERATE_DOCUMENT: 'Generează document',
        SUMMARIZE: 'Rezumă',
        FILTER: 'Filtrează',
        CREATE_REMINDER: 'Creează reminder',
        UNKNOWN: '',
      };

      const input = additionalText || intentLabels[intent] || '';
      return executeCommand(input, intent);
    },
    [executeCommand]
  );

  /**
   * Clear the current result
   */
  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    // State
    result,
    loading: loading || isProcessing,
    error,

    // Actions
    executeCommand,
    executeQuickAction,
    clearResult,

    // Convenience getters
    isSuccess: result?.status === 'SUCCESS',
    isPartial: result?.status === 'PARTIAL',
    isFailed: result?.status === 'FAILED',
    needsClarification: result?.status === 'CLARIFICATION_NEEDED',
  };
}

/**
 * Map intent to Romanian label
 */
export function getIntentLabel(intent: CommandIntent): string {
  const labels: Record<CommandIntent, string> = {
    CREATE_TASK: 'Creează sarcină',
    ADD_DOCUMENT: 'Adaugă document',
    SCHEDULE_DEADLINE: 'Programează termen',
    EMAIL_CLIENT: 'Email client',
    LOG_TIME: 'Înregistrează timp',
    SEARCH: 'Caută',
    GENERATE_DOCUMENT: 'Generează document',
    SUMMARIZE: 'Rezumă',
    FILTER: 'Filtrează',
    CREATE_REMINDER: 'Creează reminder',
    UNKNOWN: 'Necunoscut',
  };
  return labels[intent] || 'Necunoscut';
}

/**
 * Map status to Romanian message
 */
export function getStatusMessage(status: CommandStatus): string {
  const messages: Record<CommandStatus, string> = {
    SUCCESS: 'Comandă executată cu succes',
    PARTIAL: 'Comandă parțial procesată',
    FAILED: 'Comandă eșuată',
    CLARIFICATION_NEEDED: 'Este nevoie de clarificări',
  };
  return messages[status] || 'Status necunoscut';
}
