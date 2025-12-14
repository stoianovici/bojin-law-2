/**
 * Natural Language Commands Resolvers
 * Story 1.5: QuickActionsBar AI Processing
 *
 * GraphQL resolvers for processing natural language input
 */

import { GraphQLError } from 'graphql';
import {
  naturalLanguageCommandService,
  CommandIntent,
  CommandStatus,
} from '../../services/natural-language-command.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: string;
  };
}

interface ProcessCommandInput {
  input: string;
  caseId: string;
  preselectedIntent?: string;
}

// ============================================================================
// Resolvers
// ============================================================================

export const naturalLanguageCommandsResolvers = {
  Mutation: {
    /**
     * Process a natural language command and execute the appropriate action
     */
    processNaturalLanguageCommand: async (
      _: unknown,
      args: { input: ProcessCommandInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { input: commandInput, caseId, preselectedIntent } = args.input;

      if (!commandInput || commandInput.trim().length === 0) {
        throw new GraphQLError('Comanda nu poate fi goală', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (commandInput.length > 500) {
        throw new GraphQLError('Comanda este prea lungă (maxim 500 caractere)', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        const result = await naturalLanguageCommandService.processCommand(
          {
            input: commandInput,
            caseId,
            preselectedIntent: preselectedIntent as CommandIntent | undefined,
          },
          {
            userId: user.id,
            firmId: user.firmId,
          }
        );

        return result;
      } catch (error) {
        console.error('Error processing natural language command:', error);
        throw new GraphQLError(
          error instanceof Error ? error.message : 'Eroare la procesarea comenzii',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },
  },

  // Enum resolvers for GraphQL
  CommandIntent: {
    CREATE_TASK: CommandIntent.CREATE_TASK,
    ADD_DOCUMENT: CommandIntent.ADD_DOCUMENT,
    SCHEDULE_DEADLINE: CommandIntent.SCHEDULE_DEADLINE,
    EMAIL_CLIENT: CommandIntent.EMAIL_CLIENT,
    LOG_TIME: CommandIntent.LOG_TIME,
    UNKNOWN: CommandIntent.UNKNOWN,
  },

  CommandStatus: {
    SUCCESS: CommandStatus.SUCCESS,
    PARTIAL: CommandStatus.PARTIAL,
    FAILED: CommandStatus.FAILED,
    CLARIFICATION_NEEDED: CommandStatus.CLARIFICATION_NEEDED,
  },
};

export default naturalLanguageCommandsResolvers;
