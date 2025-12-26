/**
 * AI Assistant Resolvers
 * OPS-068: AI Assistant Resolvers
 * OPS-084: Updated to use direct Sonnet conversation with tool calling
 *
 * GraphQL resolvers that wire the AI assistant schema to the AI assistant service.
 * Uses native Claude tool calling instead of two-stage intent detection.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { conversationService } from '../../services/conversation.service';
import { aiAssistantService } from '../../services/ai-assistant.service';
import { briefingHandler } from '../../services/intent-handlers/briefing.handler';
import type { AIConversation, AIMessage, ConversationStatus } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface SendMessageInput {
  conversationId?: string;
  content: string;
  caseId?: string;
  context?: {
    currentScreen?: string;
    currentCaseId?: string;
    currentDocumentId?: string;
    selectedEmailId?: string;
    selectedText?: string;
  };
}

interface ConfirmActionInput {
  messageId: string;
  confirmed: boolean;
  modifications?: Record<string, unknown>;
}

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: string;
    email: string;
    accessToken?: string;
  };
}

interface ActionResult {
  success: boolean;
  message: string;
  entityId?: string;
  entityType?: string;
  navigationUrl?: string;
  error?: string;
}

// ============================================================================
// Resolvers
// ============================================================================

export const aiAssistantResolvers = {
  Query: {
    /**
     * Get active conversation for current context.
     */
    activeConversation: async (
      _: unknown,
      args: { caseId?: string },
      context: Context
    ): Promise<AIConversation | null> => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return conversationService.getOrCreateConversation(
        { userId: context.user.id, firmId: context.user.firmId },
        args.caseId ?? undefined
      );
    },

    /**
     * Get conversation by ID.
     */
    conversation: async (
      _: unknown,
      args: { id: string },
      context: Context
    ): Promise<AIConversation | null> => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return conversationService.getConversation(args.id, context.user.firmId);
    },

    /**
     * Get conversation history.
     */
    conversationHistory: async (
      _: unknown,
      args: { limit?: number; caseId?: string },
      context: Context
    ): Promise<AIConversation[]> => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return conversationService.getHistory(
        { userId: context.user.id, firmId: context.user.firmId },
        args.limit ?? 10,
        args.caseId ?? undefined
      );
    },
  },

  Mutation: {
    /**
     * Send a message to the AI assistant.
     * OPS-084: Uses direct Sonnet conversation with tool calling.
     */
    sendAssistantMessage: async (
      _: unknown,
      args: { input: SendMessageInput },
      context: Context
    ) => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { input } = args;

      // Build assistant context from input
      // OPS-256: Include accessToken for SharePoint document upload
      const assistantContext = {
        userId: context.user.id,
        firmId: context.user.firmId,
        caseId: input.caseId || input.context?.currentCaseId,
        caseName: undefined,
        currentScreen: input.context?.currentScreen,
        selectedEmailId: input.context?.selectedEmailId,
        selectedDocumentId: input.context?.currentDocumentId,
        accessToken: context.user.accessToken,
      };

      try {
        // Process message using new AI Assistant Service with tool calling
        const result = await aiAssistantService.processMessage(
          input.conversationId,
          input.content,
          assistantContext
        );

        // Get updated conversation
        const conversation = await conversationService.getConversation(
          result.conversationId,
          context.user.firmId
        );

        // Get the assistant message
        const assistantMessage = await prisma.aIMessage.findUnique({
          where: { id: result.messageId },
        });

        // Update conversation status if action proposed
        if (result.pendingAction) {
          await conversationService.updateStatus(
            result.conversationId,
            'AwaitingConfirmation' as ConversationStatus,
            context.user.firmId
          );
        }

        return {
          message: assistantMessage,
          conversation,
          suggestedFollowUps: result.suggestedFollowUps || [],
        };
      } catch (error) {
        console.error('[AI Assistant Resolver] Error processing message:', error);
        throw new GraphQLError(
          error instanceof Error ? error.message : 'Eroare la procesarea mesajului',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
      }
    },

    /**
     * Confirm or reject a proposed action.
     * OPS-084: Uses AI Assistant Service for confirmation.
     * OPS-097: Passes user modifications (e.g., estimatedHours) to the service.
     */
    confirmAction: async (
      _: unknown,
      args: { input: ConfirmActionInput },
      context: Context
    ): Promise<ActionResult> => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { input } = args;

      // Get the message to find its conversation and caseId
      const message = await prisma.aIMessage.findUnique({
        where: { id: input.messageId },
        include: { conversation: true },
      });

      if (!message) {
        throw new GraphQLError('Mesajul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Build context with caseId from the conversation
      // OPS-256: Include accessToken for SharePoint document upload
      const assistantContext = {
        userId: context.user.id,
        firmId: context.user.firmId,
        caseId: message.conversation.caseId ?? undefined,
        accessToken: context.user.accessToken,
      };

      try {
        if (!input.confirmed) {
          // User rejected action - use AI Assistant Service
          const result = await aiAssistantService.rejectAction(input.messageId, assistantContext);

          // Update conversation status back to Active
          await conversationService.updateStatus(
            message.conversationId,
            'Active' as ConversationStatus,
            context.user.firmId
          );

          return {
            success: true,
            message: result.message,
          };
        }

        // User confirmed action - execute via AI Assistant Service
        // OPS-097: Pass modifications to merge into action payload
        const result = await aiAssistantService.confirmAction(
          input.messageId,
          assistantContext,
          input.modifications
        );

        // Update conversation status back to Active
        await conversationService.updateStatus(
          message.conversationId,
          'Active' as ConversationStatus,
          context.user.firmId
        );

        return {
          success: true,
          message: result.message,
        };
      } catch (error) {
        console.error('[AI Assistant Resolver] Error confirming action:', error);
        throw new GraphQLError(
          error instanceof Error ? error.message : 'Eroare la confirmarea acțiunii',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
      }
    },

    /**
     * Close a conversation.
     */
    closeConversation: async (
      _: unknown,
      args: { id: string },
      context: Context
    ): Promise<AIConversation> => {
      if (!context.user) {
        throw new GraphQLError('Autentificare necesară', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return conversationService.closeConversation(args.id, context.user.firmId);
    },
  },

  // ============================================================================
  // Field Resolvers
  // ============================================================================

  AIConversation: {
    /**
     * Get message count for conversation.
     */
    messageCount: async (conversation: AIConversation): Promise<number> => {
      return prisma.aIMessage.count({ where: { conversationId: conversation.id } });
    },

    /**
     * Get linked case for conversation.
     */
    case: async (conversation: AIConversation) => {
      if (!conversation.caseId) return null;
      return prisma.case.findUnique({ where: { id: conversation.caseId } });
    },

    /**
     * Get all messages for conversation.
     */
    messages: async (conversation: AIConversation): Promise<AIMessage[]> => {
      return prisma.aIMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      });
    },
  },

  AIMessage: {
    /**
     * Build proposed action from message fields.
     * OPS-086: Updated to use stored preview info from actionPayload
     * OPS-097: Added editableFields for create_task
     */
    proposedAction: (message: AIMessage) => {
      if (!message.actionType) return null;

      // Extract stored preview info if available (from OPS-084+ tool calling)
      const payload = message.actionPayload as {
        toolCallId?: string;
        input?: Record<string, unknown>;
        preview?: string;
        confirmationPrompt?: string;
      } | null;

      // Build entity preview from input parameters for display
      const entityPreview = payload?.input
        ? buildEntityPreview(message.actionType, payload.input)
        : undefined;

      // Build editable fields for actions that support them
      const editableFields = getEditableFields(message.actionType, payload?.input);

      return {
        type: message.actionType,
        displayText: getActionDisplayText(message.actionType),
        payload: message.actionPayload ?? {},
        status: message.actionStatus ?? 'Proposed',
        requiresConfirmation: true,
        // Use stored confirmation prompt if available, otherwise fall back to static
        confirmationPrompt:
          payload?.confirmationPrompt || getConfirmationPrompt(message.actionType),
        // Provide entity preview for UI display
        entityPreview,
        // OPS-097: Include editable fields for supported actions
        editableFields,
      };
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display text for action type (Romanian).
 * Supports both old intent names and new tool names from OPS-084.
 */
function getActionDisplayText(actionType: string): string {
  const displayTexts: Record<string, string> = {
    // Legacy intent names
    CreateTask: 'Creează sarcină',
    UpdateTask: 'Actualizează sarcină',
    ScheduleEvent: 'Programează eveniment',
    DraftEmail: 'Redactează email',
    GenerateDocument: 'Generează document',
    SearchEmails: 'Caută emailuri',
    FindDocument: 'Caută document',

    // New tool names (OPS-084)
    create_task: 'Creează sarcină',
    list_tasks: 'Listează sarcini',
    update_task: 'Actualizează sarcină',
    get_case_summary: 'Rezumat dosar',
    search_cases: 'Caută dosare',
    get_case_deadlines: 'Termene dosar',
    get_case_actors: 'Părți dosar',
    search_emails: 'Caută emailuri',
    summarize_email_thread: 'Rezumă conversație',
    draft_email_reply: 'Redactează răspuns',
    get_recent_emails: 'Emailuri recente',
    search_documents: 'Caută documente',
    summarize_document: 'Rezumă document',
    generate_document: 'Generează document',
    list_case_documents: 'Documente dosar',
    get_calendar: 'Vezi calendar',
    create_calendar_event: 'Programează eveniment',
    get_morning_briefing: 'Briefing zilnic',
    get_proactive_alerts: 'Alerte active',
  };
  return displayTexts[actionType] || actionType;
}

/**
 * Get confirmation prompt for action type (Romanian).
 * Supports both old intent names and new tool names from OPS-084.
 */
function getConfirmationPrompt(actionType: string): string {
  const prompts: Record<string, string> = {
    // Legacy intent names
    CreateTask: 'Creez această sarcină?',
    UpdateTask: 'Actualizez această sarcină?',
    ScheduleEvent: 'Adaug în calendar?',
    DraftEmail: 'Folosiți acest răspuns?',
    GenerateDocument: 'Generez acest document?',
    SearchEmails: 'Caut aceste emailuri?',
    FindDocument: 'Caut acest document?',

    // New tool names (OPS-084)
    create_task: 'Creez această sarcină?',
    list_tasks: 'Afișez sarcinile?',
    update_task: 'Actualizez această sarcină?',
    get_case_summary: 'Afișez rezumatul?',
    search_cases: 'Caut aceste dosare?',
    get_case_deadlines: 'Afișez termenele?',
    get_case_actors: 'Afișez părțile?',
    search_emails: 'Caut aceste emailuri?',
    summarize_email_thread: 'Rezum conversația?',
    draft_email_reply: 'Folosiți acest răspuns?',
    get_recent_emails: 'Afișez emailurile recente?',
    search_documents: 'Caut aceste documente?',
    summarize_document: 'Rezum acest document?',
    generate_document: 'Generez acest document?',
    list_case_documents: 'Afișez documentele?',
    get_calendar: 'Afișez calendarul?',
    create_calendar_event: 'Programez acest eveniment?',
    get_morning_briefing: 'Afișez briefingul?',
    get_proactive_alerts: 'Afișez alertele?',
  };
  return prompts[actionType] || 'Confirmați această acțiune?';
}

/**
 * Build entity preview from input parameters for display in ActionConfirmCard.
 * Extracts the most relevant fields for each action type.
 */
function buildEntityPreview(
  actionType: string,
  input: Record<string, unknown>
): Record<string, unknown> | undefined {
  switch (actionType) {
    case 'create_task':
    case 'CreateTask':
      return {
        Titlu: input.title,
        ...(input.dueDate && { Termen: formatDateRomanian(input.dueDate as string) }),
        ...(input.priority && { Prioritate: translatePriority(input.priority as string) }),
      };

    case 'update_task':
    case 'UpdateTask':
      return {
        ...(input.status && { Status: translateStatus(input.status as string) }),
        ...(input.dueDate && { Termen: formatDateRomanian(input.dueDate as string) }),
        ...(input.priority && { Prioritate: translatePriority(input.priority as string) }),
      };

    case 'create_calendar_event':
    case 'ScheduleEvent':
      return {
        Titlu: input.title,
        ...(input.startTime && { Data: formatDateTimeRomanian(input.startTime as string) }),
        ...(input.location && { Locație: input.location }),
      };

    case 'draft_email_reply':
    case 'DraftEmail':
      return {
        ...(input.tone && { Ton: translateTone(input.tone as string) }),
        ...(input.recipientType && {
          Destinatar: translateRecipientType(input.recipientType as string),
        }),
      };

    case 'generate_document':
    case 'GenerateDocument':
      return {
        Tip: translateDocType(input.templateType as string),
        ...(input.instructions && {
          Instrucțiuni: (input.instructions as string).substring(0, 100),
        }),
      };

    case 'search_emails':
    case 'SearchEmails':
      return {
        ...(input.query && { Căutare: input.query }),
        ...(input.sender && { Expeditor: input.sender }),
      };

    case 'search_documents':
    case 'FindDocument':
      return {
        ...(input.query && { Căutare: input.query }),
        ...(input.documentType && { Tip: input.documentType }),
      };

    default:
      return undefined;
  }
}

/**
 * Format date in Romanian format.
 */
function formatDateRomanian(isoDate: string): string {
  if (!isoDate) return 'nedefinit';
  try {
    return new Date(isoDate).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format date and time in Romanian format.
 */
function formatDateTimeRomanian(isoDateTime: string): string {
  if (!isoDateTime) return 'nedefinit';
  try {
    return new Date(isoDateTime).toLocaleString('ro-RO', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDateTime;
  }
}

/**
 * Translate priority to Romanian.
 */
function translatePriority(priority: string): string {
  const map: Record<string, string> = {
    Low: 'Scăzută',
    Medium: 'Medie',
    High: 'Ridicată',
    Urgent: 'Urgentă',
  };
  return map[priority] || priority;
}

/**
 * Translate status to Romanian.
 */
function translateStatus(status: string): string {
  const map: Record<string, string> = {
    Pending: 'În așteptare',
    InProgress: 'În lucru',
    Completed: 'Finalizat',
    Cancelled: 'Anulat',
    pending: 'În așteptare',
    in_progress: 'În lucru',
    completed: 'Finalizat',
    cancelled: 'Anulat',
  };
  return map[status] || status;
}

/**
 * Translate tone to Romanian.
 */
function translateTone(tone: string): string {
  const map: Record<string, string> = {
    formal: 'Formal',
    professional: 'Profesional',
    brief: 'Concis',
    Formal: 'Formal',
    Professional: 'Profesional',
    Brief: 'Concis',
  };
  return map[tone] || tone;
}

/**
 * Translate recipient type to Romanian.
 */
function translateRecipientType(recipientType: string): string {
  const map: Record<string, string> = {
    Client: 'Client',
    Court: 'Instanță',
    OpposingCounsel: 'Avocat adversar',
    ThirdParty: 'Terț',
  };
  return map[recipientType] || recipientType;
}

/**
 * Translate document type to Romanian.
 */
function translateDocType(docType: string): string {
  const map: Record<string, string> = {
    Contract: 'Contract',
    Motion: 'Cerere',
    Letter: 'Scrisoare',
    Memo: 'Memoriu',
    Pleading: 'Act de procedură',
    Other: 'Document',
  };
  return map[docType] || docType;
}

// ============================================================================
// Editable Fields (OPS-097)
// ============================================================================

interface EditableField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  required: boolean;
  placeholder?: string;
  suggestion?: string;
  defaultValue?: unknown;
  quickOptions?: { value: string; label: string }[];
}

/**
 * Duration suggestions by task type (in hours).
 */
const DURATION_SUGGESTIONS: Record<string, string> = {
  Research: '~4 ore pentru sarcini de cercetare',
  DocumentCreation: '~2 ore pentru crearea documentelor',
  DocumentRetrieval: '~1 oră pentru obținerea documentelor',
  CourtDate: 'durata ședinței de judecată',
  Meeting: '~1 oră pentru întâlniri',
  BusinessTrip: 'durata deplasării',
  Drafting: '~2 ore pentru redactare',
  Review: '~2 ore pentru revizuire',
  Filing: '~1 oră pentru depunere',
  Communication: '~1 oră pentru comunicare',
  Other: '~2 ore în medie',
};

/**
 * Get editable fields for an action type.
 * OPS-097: Currently only create_task has editable fields.
 */
function getEditableFields(
  actionType: string,
  input?: Record<string, unknown>
): EditableField[] | undefined {
  // Only create_task and CreateTask have editable fields for now
  if (actionType !== 'create_task' && actionType !== 'CreateTask') {
    return undefined;
  }

  // Get task type from input to provide appropriate suggestion
  const taskType = (input?.taskType as string) || 'Other';
  const suggestion = DURATION_SUGGESTIONS[taskType] || DURATION_SUGGESTIONS.Other;

  return [
    {
      key: 'estimatedHours',
      label: 'Durată estimată',
      type: 'number',
      required: true,
      placeholder: 'ore',
      suggestion,
      defaultValue: undefined,
      quickOptions: [
        { value: '1', label: '1h' },
        { value: '2', label: '2h' },
        { value: '4', label: '4h' },
        { value: '8', label: '8h' },
      ],
    },
  ];
}
