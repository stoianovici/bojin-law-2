/**
 * AI Assistant Service
 * OPS-084: Direct Sonnet Conversation with Tool Calling
 *
 * Replaces the two-stage Haiku orchestrator with a single Claude Sonnet
 * conversation using native tool calling. This fixes Romanian prompt parsing
 * by leveraging Claude's natural language understanding.
 *
 * Architecture:
 * Message → Sonnet (with tools) → Tool Calls → Execute → Response
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@legal-platform/database';
import { TaskPriority, TaskTypeEnum, TaskStatus, CaseStatus } from '@prisma/client';
import { AI_TOOLS, AIToolName, isValidToolName } from './ai-tools.schema';
import { buildSystemPrompt, getCurrentDateISO } from './ai-system-prompt';
import { conversationService } from './conversation.service';
import { AIMessageRole, AIActionStatus } from '@prisma/client';
import { CreateTaskInput as TaskServiceInput } from './task-validation.service';
import type { TaskType } from '@legal-platform/types';
import { aiClient } from './ai-client.service';

// ============================================================================
// Types
// ============================================================================

export interface AssistantContext {
  userId: string;
  firmId: string;
  caseId?: string;
  caseName?: string;
  currentScreen?: string;
  selectedEmailId?: string;
  selectedDocumentId?: string;
  accessToken?: string;
}

export interface PendingAction {
  toolCallId: string;
  toolName: AIToolName;
  parameters: Record<string, unknown>;
  preview: string;
  confirmationPrompt: string;
}

export interface AssistantResponse {
  message: string;
  conversationId: string;
  messageId: string;
  pendingAction?: PendingAction;
  suggestedFollowUps?: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
  entityId?: string;
  entityType?: string;
  navigationUrl?: string;
}

// ============================================================================
// Tool Preview & Execution Types
// ============================================================================

interface ToolPreview {
  description: string;
  summary: string;
  confirmationPrompt: string;
}

// ============================================================================
// Timezone Helpers
// ============================================================================

/**
 * Get the timezone offset in minutes for a specific timezone at a specific date
 * This handles DST correctly by checking the offset at the given date
 * @param timezone - IANA timezone name (e.g., 'Europe/Bucharest')
 * @param date - The date to check the offset for
 * @returns Offset in minutes (positive for timezones behind UTC, negative for ahead)
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  // Format the date in the target timezone and in UTC
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - tzDate.getTime()) / 60000;
}

// ============================================================================
// Service
// ============================================================================

export class AIAssistantService {
  // Note: Using aiClient singleton for AI calls (OPS-233) for usage logging
  constructor() {
    // No direct Anthropic client needed - using aiClient wrapper
  }

  /**
   * Process a user message using Claude Sonnet with native tool calling.
   * This replaces the two-stage Haiku intent detection pipeline.
   */
  async processMessage(
    conversationId: string | undefined,
    userMessage: string,
    context: AssistantContext
  ): Promise<AssistantResponse> {
    // Get or create conversation
    let conversation = conversationId
      ? await conversationService.getConversation(conversationId, context.firmId)
      : await conversationService.getOrCreateConversation(
          { userId: context.userId, firmId: context.firmId },
          context.caseId
        );

    if (!conversation) {
      throw new Error('Nu s-a putut crea conversația');
    }

    // If conversation has no caseId but context provides one, update it
    if (!conversation.caseId && context.caseId) {
      conversation = await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { caseId: context.caseId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    // Get conversation history for context
    const conversationWithMessages = await conversationService.getConversation(
      conversation.id,
      context.firmId
    );
    const history = conversationWithMessages?.messages ?? [];

    // Build system prompt with context
    const systemPrompt = await this.buildContextualSystemPrompt(context);

    // Build messages array from history + new user message
    // Filter out messages with pending actions (incomplete tool exchanges) to prevent
    // "tool_use ids without tool_result" errors from the Anthropic API
    const sanitizedHistory = history.filter((m) => {
      // Skip messages with pending/proposed actions - these indicate incomplete tool exchanges
      if (m.actionStatus === 'Proposed') {
        console.log('[AIAssistant] Skipping message with pending action:', m.id);
        return false;
      }
      return true;
    });

    const messages: Anthropic.MessageParam[] = [
      ...sanitizedHistory.map((m) => ({
        role: (m.role === 'User' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    // Save user message to conversation
    await conversationService.addMessage(
      conversation.id,
      {
        role: 'User' as AIMessageRole,
        content: userMessage,
      },
      context.firmId
    );

    // Call Claude Sonnet with tools (via aiClient for usage logging)
    const aiResponse = await aiClient.chat(
      messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        feature: 'assistant_chat',
        userId: context.userId,
        firmId: context.firmId,
        entityType: context.caseId ? 'case' : undefined,
        entityId: context.caseId,
      },
      {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        system: systemPrompt,
        tools: AI_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        })),
      }
    );

    // Convert aiClient response to Anthropic.Message format for processResponse
    const response: Anthropic.Message = {
      id: 'msg_' + Date.now(),
      type: 'message',
      role: 'assistant',
      content: aiResponse.content,
      model: aiResponse.model,
      stop_reason: aiResponse.stopReason as Anthropic.Message['stop_reason'],
      stop_sequence: null,
      usage: {
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
      } as Anthropic.Usage,
    };

    // Process the response
    return this.processResponse(response, conversation.id, context);
  }

  // Read-only tools that execute immediately without confirmation
  private static readonly READ_ONLY_TOOLS: AIToolName[] = [
    'search_cases',
    'list_tasks',
    'get_case_summary',
    'get_case_deadlines',
    'get_case_actors',
    'search_emails',
    'get_recent_emails',
    'search_documents',
    'list_case_documents',
    'get_calendar',
    'get_morning_briefing',
    'get_proactive_alerts',
  ];

  /**
   * Check if a tool is read-only (doesn't modify data)
   */
  private isReadOnlyTool(toolName: AIToolName): boolean {
    return AIAssistantService.READ_ONLY_TOOLS.includes(toolName);
  }

  /**
   * Process Claude's response, handling text and tool calls.
   */
  private async processResponse(
    response: Anthropic.Message,
    conversationId: string,
    context: AssistantContext
  ): Promise<AssistantResponse> {
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    // If no tool calls, just return the text response
    if (toolBlocks.length === 0) {
      const message = textBlocks.map((b) => b.text).join('\n');

      const savedMessage = await conversationService.addMessage(
        conversationId,
        {
          role: 'Assistant' as AIMessageRole,
          content: message,
        },
        context.firmId
      );

      return {
        message,
        conversationId,
        messageId: savedMessage.id,
        suggestedFollowUps: this.getSuggestedFollowUps(null),
      };
    }

    // Handle tool call
    const toolCall = toolBlocks[0];
    const toolName = toolCall.name;

    if (!isValidToolName(toolName)) {
      const errorMessage = `Unealtă necunoscută: ${toolName}`;
      const savedMessage = await conversationService.addMessage(
        conversationId,
        {
          role: 'Assistant' as AIMessageRole,
          content: errorMessage,
        },
        context.firmId
      );

      return {
        message: errorMessage,
        conversationId,
        messageId: savedMessage.id,
      };
    }

    // Read-only tools execute immediately without confirmation
    if (this.isReadOnlyTool(toolName)) {
      const result = await this.executeTool(
        toolName,
        toolCall.input as Record<string, unknown>,
        context
      );

      // Continue the conversation with Claude, giving it the tool result
      // This allows Claude to make follow-up tool calls (e.g., search_cases → create_task)
      return await this.continueWithToolResult(conversationId, response, toolCall, result, context);
    }

    // Write tools require confirmation - generate preview
    const preview = await this.generateToolPreview(
      toolName,
      toolCall.input as Record<string, unknown>,
      context
    );

    // Build response message from text blocks or preview
    const responseText = textBlocks.map((b) => b.text).join('\n') || preview.description;

    // Save assistant message with pending action
    // Include preview info in payload so resolver can use it
    const savedMessage = await conversationService.addMessage(
      conversationId,
      {
        role: 'Assistant' as AIMessageRole,
        content: responseText,
        actionType: toolName,
        actionPayload: {
          toolCallId: toolCall.id,
          input: toolCall.input,
          preview: preview.summary,
          confirmationPrompt: preview.confirmationPrompt,
        },
        actionStatus: 'Proposed' as AIActionStatus,
      },
      context.firmId
    );

    return {
      message: responseText,
      conversationId,
      messageId: savedMessage.id,
      pendingAction: {
        toolCallId: toolCall.id,
        toolName,
        parameters: toolCall.input as Record<string, unknown>,
        preview: preview.summary,
        confirmationPrompt: preview.confirmationPrompt,
      },
      suggestedFollowUps: this.getSuggestedFollowUps(toolName),
    };
  }

  /**
   * Confirm and execute a pending action.
   * OPS-097: Accepts optional modifications to merge into action payload.
   */
  async confirmAction(
    messageId: string,
    context: AssistantContext,
    modifications?: Record<string, unknown>
  ): Promise<AssistantResponse> {
    // Get the message with pending action
    const message = await prisma.aIMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.firmId !== context.firmId) {
      throw new Error('Mesajul nu a fost găsit');
    }

    const actionPayload = message.actionPayload as {
      toolCallId?: string;
      input?: Record<string, unknown>;
    } | null;

    if (!message.actionType || !actionPayload?.input) {
      return {
        message: 'Nu există nicio acțiune de confirmat.',
        conversationId: message.conversationId,
        messageId: message.id,
      };
    }

    // OPS-097: Merge user modifications into the action input
    // This allows users to add/modify fields like estimatedHours before execution
    const mergedInput = modifications
      ? { ...actionPayload.input, ...modifications }
      : actionPayload.input;

    console.log('[AIAssistant] confirmAction executing tool:', message.actionType);
    console.log('[AIAssistant] confirmAction original input:', JSON.stringify(actionPayload.input));
    if (modifications) {
      console.log('[AIAssistant] confirmAction modifications:', JSON.stringify(modifications));
      console.log('[AIAssistant] confirmAction merged input:', JSON.stringify(mergedInput));
    }

    // Execute the tool with merged input
    const result = await this.executeTool(message.actionType as AIToolName, mergedInput, context);

    // Update action status
    await conversationService.updateMessageActionStatus(
      messageId,
      result.success ? ('Executed' as AIActionStatus) : ('Failed' as AIActionStatus),
      context.firmId
    );

    // Create response message
    const responseMessage = result.success ? result.message : `Eroare: ${result.message}`;

    // Save the result message
    const savedMessage = await conversationService.addMessage(
      message.conversationId,
      {
        role: 'Assistant' as AIMessageRole,
        content: responseMessage,
      },
      context.firmId
    );

    return {
      message: responseMessage,
      conversationId: message.conversationId,
      messageId: savedMessage.id,
      suggestedFollowUps: result.success
        ? this.getPostActionFollowUps(message.actionType as AIToolName)
        : ['Încercați din nou', 'Ajutor'],
    };
  }

  /**
   * Reject a pending action.
   */
  async rejectAction(messageId: string, context: AssistantContext): Promise<AssistantResponse> {
    // Get the message with pending action
    const message = await prisma.aIMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.firmId !== context.firmId) {
      throw new Error('Mesajul nu a fost găsit');
    }

    // Update action status
    await conversationService.updateMessageActionStatus(
      messageId,
      'Rejected' as AIActionStatus,
      context.firmId
    );

    const responseMessage = 'Am anulat acțiunea. Cu ce altceva te pot ajuta?';

    // Save cancellation message
    const savedMessage = await conversationService.addMessage(
      message.conversationId,
      {
        role: 'Assistant' as AIMessageRole,
        content: responseMessage,
      },
      context.firmId
    );

    return {
      message: responseMessage,
      conversationId: message.conversationId,
      messageId: savedMessage.id,
      suggestedFollowUps: ['Creează o sarcină', 'Caută în dosare', 'Ajutor'],
    };
  }

  // ============================================================================
  // Agentic Loop - Continue conversation after tool execution
  // ============================================================================

  /**
   * Continue the conversation with Claude after executing a tool.
   * This enables multi-step tool calling (e.g., search_cases → create_task).
   */
  private async continueWithToolResult(
    conversationId: string,
    previousResponse: Anthropic.Message,
    toolCall: Anthropic.ToolUseBlock,
    toolResult: ToolExecutionResult,
    context: AssistantContext,
    depth: number = 0
  ): Promise<AssistantResponse> {
    // Prevent infinite loops
    const MAX_DEPTH = 5;
    if (depth >= MAX_DEPTH) {
      console.warn('[AIAssistant] Max tool depth reached, returning result');
      return this.returnToolResult(conversationId, toolResult, context);
    }

    // Build the conversation so far
    const conversationWithMessages = await conversationService.getConversation(
      conversationId,
      context.firmId
    );
    const history = conversationWithMessages?.messages ?? [];

    const systemPrompt = await this.buildContextualSystemPrompt(context);

    // Filter out messages with pending actions to prevent orphaned tool_use errors
    const sanitizedHistory = history.filter((m) => m.actionStatus !== 'Proposed');

    // Build messages: history + assistant's tool call + tool result
    const messages: Anthropic.MessageParam[] = [
      ...sanitizedHistory.map((m) => ({
        role: (m.role === 'User' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      // The assistant's response that contained the tool call
      {
        role: 'assistant' as const,
        content: previousResponse.content,
      },
      // The tool result
      {
        role: 'user' as const,
        content: [
          {
            type: 'tool_result' as const,
            tool_use_id: toolCall.id,
            content: JSON.stringify({
              success: toolResult.success,
              message: toolResult.message,
              data: toolResult.data,
            }),
          },
        ],
      },
    ];

    console.log('[AIAssistant] Continuing with tool result, depth:', depth);

    // Call Claude again with the tool result (via aiClient for usage logging)
    const aiResponse = await aiClient.chat(
      messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string | Anthropic.ContentBlockParam[],
      })),
      {
        feature: 'assistant_chat',
        userId: context.userId,
        firmId: context.firmId,
        entityType: context.caseId ? 'case' : undefined,
        entityId: context.caseId,
      },
      {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        system: systemPrompt,
        tools: AI_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        })),
      }
    );

    // Convert aiClient response to Anthropic.Message format for recursive calls
    const response: Anthropic.Message = {
      id: 'msg_' + Date.now(),
      type: 'message',
      role: 'assistant',
      content: aiResponse.content,
      model: aiResponse.model,
      stop_reason: aiResponse.stopReason as Anthropic.Message['stop_reason'],
      stop_sequence: null,
      usage: {
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
      } as Anthropic.Usage,
    };

    // Process the new response
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    // If no more tool calls, return the text response
    if (toolBlocks.length === 0) {
      const message = textBlocks.map((b) => b.text).join('\n');

      const savedMessage = await conversationService.addMessage(
        conversationId,
        {
          role: 'Assistant' as AIMessageRole,
          content: message,
        },
        context.firmId
      );

      return {
        message,
        conversationId,
        messageId: savedMessage.id,
        suggestedFollowUps: this.getSuggestedFollowUps(null),
      };
    }

    // Handle the next tool call
    const nextToolCall = toolBlocks[0];
    const nextToolName = nextToolCall.name;

    if (!isValidToolName(nextToolName)) {
      const errorMessage = `Unealtă necunoscută: ${nextToolName}`;
      const savedMessage = await conversationService.addMessage(
        conversationId,
        { role: 'Assistant' as AIMessageRole, content: errorMessage },
        context.firmId
      );
      return { message: errorMessage, conversationId, messageId: savedMessage.id };
    }

    // If it's another read-only tool, execute and continue
    if (this.isReadOnlyTool(nextToolName)) {
      const nextResult = await this.executeTool(
        nextToolName,
        nextToolCall.input as Record<string, unknown>,
        context
      );
      return await this.continueWithToolResult(
        conversationId,
        response,
        nextToolCall,
        nextResult,
        context,
        depth + 1
      );
    }

    // Write tool - requires confirmation
    const preview = await this.generateToolPreview(
      nextToolName,
      nextToolCall.input as Record<string, unknown>,
      context
    );

    const responseText = textBlocks.map((b) => b.text).join('\n') || preview.description;

    const savedMessage = await conversationService.addMessage(
      conversationId,
      {
        role: 'Assistant' as AIMessageRole,
        content: responseText,
        actionType: nextToolName,
        actionPayload: {
          toolCallId: nextToolCall.id,
          input: nextToolCall.input,
          preview: preview.summary,
          confirmationPrompt: preview.confirmationPrompt,
        },
        actionStatus: 'Proposed' as AIActionStatus,
      },
      context.firmId
    );

    return {
      message: responseText,
      conversationId,
      messageId: savedMessage.id,
      pendingAction: {
        toolCallId: nextToolCall.id,
        toolName: nextToolName,
        parameters: nextToolCall.input as Record<string, unknown>,
        preview: preview.summary,
        confirmationPrompt: preview.confirmationPrompt,
      },
      suggestedFollowUps: this.getSuggestedFollowUps(nextToolName),
    };
  }

  /**
   * Return tool result directly as a response (fallback when loop limit reached).
   */
  private async returnToolResult(
    conversationId: string,
    result: ToolExecutionResult,
    context: AssistantContext
  ): Promise<AssistantResponse> {
    const savedMessage = await conversationService.addMessage(
      conversationId,
      { role: 'Assistant' as AIMessageRole, content: result.message },
      context.firmId
    );

    return {
      message: result.message,
      conversationId,
      messageId: savedMessage.id,
      suggestedFollowUps: this.getSuggestedFollowUps(null),
    };
  }

  // ============================================================================
  // Tool Preview Generation
  // ============================================================================

  /**
   * Generate a human-readable preview of what a tool call will do.
   */
  private async generateToolPreview(
    toolName: AIToolName,
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolPreview> {
    switch (toolName) {
      case 'create_task': {
        const title = (input.title as string) || 'Sarcină nouă';
        const dueDate = input.dueDate
          ? this.formatDateRomanian(input.dueDate as string)
          : 'fără termen';
        const priority = (input.priority as string) || 'Medium';

        return {
          description: `Voi crea sarcina "${title}" cu termen ${dueDate}.`,
          summary: `Creez: ${title} (${dueDate}, ${this.translatePriority(priority)})`,
          confirmationPrompt: `Creez sarcina "${title}"?`,
        };
      }

      case 'list_tasks': {
        const timeRange = (input.timeRange as string) || 'week';
        const status = (input.status as string) || 'pending';

        return {
          description: `Afișez sarcinile ${this.translateStatus(status)} pentru ${this.translateTimeRange(timeRange)}.`,
          summary: `Listez sarcinile ${this.translateStatus(status)}`,
          confirmationPrompt: 'Afișez sarcinile?',
        };
      }

      case 'get_case_summary': {
        const caseId = (input.caseId as string) || context.caseId;
        const caseName = caseId ? await this.getCaseName(caseId, context.firmId) : 'necunoscut';

        return {
          description: `Afișez rezumatul dosarului ${caseName}.`,
          summary: `Rezumat: ${caseName}`,
          confirmationPrompt: 'Afișez rezumatul?',
        };
      }

      case 'search_emails': {
        const query = (input.query as string) || '';
        const sender = input.sender as string | undefined;

        return {
          description: sender
            ? `Caut emailuri de la ${sender} cu textul "${query}".`
            : `Caut emailuri care conțin "${query}".`,
          summary: `Caut: ${query || 'emailuri'}`,
          confirmationPrompt: 'Caut emailurile?',
        };
      }

      case 'draft_email_reply': {
        const tone = (input.tone as string) || 'professional';

        return {
          description: `Generez un răspuns ${this.translateTone(tone)} la email.`,
          summary: `Draft răspuns ${this.translateTone(tone)}`,
          confirmationPrompt: 'Generez răspunsul?',
        };
      }

      case 'get_morning_briefing': {
        return {
          description: 'Generez briefingul zilei cu sarcini urgente, termene și emailuri noi.',
          summary: 'Briefing zilnic',
          confirmationPrompt: 'Afișez briefingul?',
        };
      }

      case 'create_calendar_event': {
        const title = (input.title as string) || 'Eveniment';
        const startTime = input.startTime
          ? this.formatDateTimeRomanian(input.startTime as string)
          : 'nedefinit';

        return {
          description: `Programez evenimentul "${title}" pe ${startTime}.`,
          summary: `Programez: ${title}`,
          confirmationPrompt: `Programez "${title}"?`,
        };
      }

      case 'search_documents': {
        const query = (input.query as string) || '';
        const docType = input.documentType as string | undefined;

        return {
          description: docType
            ? `Caut documente de tip ${docType} cu textul "${query}".`
            : `Caut documente care conțin "${query}".`,
          summary: `Caut: ${docType || 'documente'}`,
          confirmationPrompt: 'Caut documentele?',
        };
      }

      case 'generate_document': {
        const templateType = (input.templateType as string) || 'Other';

        return {
          description: `Generez un document de tip ${this.translateDocType(templateType)}.`,
          summary: `Generez ${this.translateDocType(templateType)}`,
          confirmationPrompt: `Generez ${this.translateDocType(templateType)}?`,
        };
      }

      default: {
        return {
          description: `Execut acțiunea ${toolName}.`,
          summary: toolName,
          confirmationPrompt: 'Execut acțiunea?',
        };
      }
    }
  }

  // ============================================================================
  // Tool Execution
  // ============================================================================

  /**
   * Execute a tool and return the result.
   * Delegates to existing services (TaskService, etc.) for actual operations.
   */
  private async executeTool(
    toolName: AIToolName,
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        case 'create_task':
          return await this.executeCreateTask(input, context);

        case 'list_tasks':
          return await this.executeListTasks(input, context);

        case 'update_task':
          return await this.executeUpdateTask(input, context);

        case 'get_case_summary':
          return await this.executeGetCaseSummary(input, context);

        case 'search_cases':
          return await this.executeSearchCases(input, context);

        case 'get_case_deadlines':
          return await this.executeGetCaseDeadlines(input, context);

        case 'get_case_actors':
          return await this.executeGetCaseActors(input, context);

        case 'search_emails':
          return await this.executeSearchEmails(input, context);

        case 'get_recent_emails':
          return await this.executeGetRecentEmails(input, context);

        case 'summarize_email_thread':
          return await this.executeSummarizeEmailThread(input, context);

        case 'draft_email_reply':
          return await this.executeDraftEmailReply(input, context);

        case 'search_documents':
          return await this.executeSearchDocuments(input, context);

        case 'list_case_documents':
          return await this.executeListCaseDocuments(input, context);

        case 'summarize_document':
          return await this.executeSummarizeDocument(input, context);

        case 'generate_document':
          return await this.executeGenerateDocument(input, context);

        case 'get_calendar':
          return await this.executeGetCalendar(input, context);

        case 'create_calendar_event':
          return await this.executeCreateCalendarEvent(input, context);

        case 'get_morning_briefing':
          return await this.executeGetMorningBriefing(context);

        case 'get_proactive_alerts':
          return await this.executeGetProactiveAlerts(input, context);

        default:
          return {
            success: false,
            message: `Unealtă necunoscută: ${toolName}`,
          };
      }
    } catch (error) {
      console.error(`[AIAssistant] Error executing tool ${toolName}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Eroare necunoscută',
      };
    }
  }

  // ============================================================================
  // Tool Execution Implementations
  // ============================================================================

  private async executeCreateTask(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    console.log('[AIAssistant] executeCreateTask input:', JSON.stringify(input));
    console.log('[AIAssistant] executeCreateTask context.caseId:', context.caseId);

    const { TaskService } = await import('./task.service');
    const taskService = new TaskService();

    const caseId = (input.caseId as string) || context.caseId;

    // Ensure caseId is provided
    if (!caseId) {
      return {
        success: false,
        message: 'Trebuie să specificați un dosar pentru sarcină.',
      };
    }

    // Resolve assignee name to user ID
    let assignedTo = context.userId;
    const assigneeName = input.assignee as string | undefined;

    if (assigneeName) {
      const resolvedUser = await this.resolveUserByName(assigneeName, context.firmId);
      if (resolvedUser) {
        assignedTo = resolvedUser.id;
        console.log(
          `[AIAssistant] Resolved assignee "${assigneeName}" to user ${resolvedUser.firstName} ${resolvedUser.lastName} (${resolvedUser.id})`
        );
      } else {
        console.log(
          `[AIAssistant] Could not resolve assignee "${assigneeName}", using current user`
        );
      }
    }

    const taskType = this.mapTaskTypeEnum(input.taskType as string);
    const title = input.title as string;
    const description = input.description as string | undefined;

    // OPS-097: Parse estimatedHours from input (may come as string from quick options)
    let estimatedHours: number | undefined;
    if (input.estimatedHours !== undefined && input.estimatedHours !== null) {
      estimatedHours =
        typeof input.estimatedHours === 'string'
          ? parseFloat(input.estimatedHours)
          : (input.estimatedHours as number);
      if (isNaN(estimatedHours)) {
        estimatedHours = undefined;
      }
    }

    const taskInput: TaskServiceInput = {
      title,
      description,
      caseId,
      assignedTo,
      dueDate: input.dueDate ? new Date(input.dueDate as string) : new Date(),
      priority: this.mapPriorityEnum(input.priority as string),
      type: taskType,
      typeMetadata: this.getDefaultTypeMetadata(taskType, title, description),
      estimatedHours,
    };

    console.log('[AIAssistant] executeCreateTask taskInput.estimatedHours:', estimatedHours);

    const task = await taskService.createTask(taskInput, context.userId);

    // Get assignee name for confirmation message
    const assigneeInfo = await prisma.user.findUnique({
      where: { id: assignedTo },
      select: { firstName: true, lastName: true },
    });
    const assigneeFull = assigneeInfo
      ? `${assigneeInfo.firstName} ${assigneeInfo.lastName}`
      : 'utilizatorul curent';

    return {
      success: true,
      message: `Sarcina "${task.title}" a fost creată cu succes și asignată lui ${assigneeFull}.`,
      entityId: task.id,
      entityType: 'Task',
      navigationUrl: `/cases/${caseId}/tasks?taskId=${task.id}`,
    };
  }

  /**
   * Resolve a user by name (first name, last name, or full name).
   */
  private async resolveUserByName(
    name: string,
    firmId: string
  ): Promise<{ id: string; firstName: string; lastName: string } | null> {
    const nameLower = name.toLowerCase().trim();

    // Try exact match first (first name or last name)
    const exactMatch = await prisma.user.findFirst({
      where: {
        firmId,
        OR: [
          { firstName: { equals: name, mode: 'insensitive' } },
          { lastName: { equals: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (exactMatch) return exactMatch;

    // Try partial match
    const partialMatch = await prisma.user.findFirst({
      where: {
        firmId,
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
    });

    return partialMatch;
  }

  /**
   * Generate default type-specific metadata for AI-created tasks.
   * Uses the task title and description to populate required fields.
   */
  private getDefaultTypeMetadata(
    taskType: TaskType,
    title: string,
    description?: string
  ): Record<string, unknown> {
    switch (taskType) {
      case 'Research':
        return {
          researchTopic: title,
          findings: description || '',
        };
      case 'DocumentCreation':
        return {
          documentType: 'General',
          draftStatus: 'NotStarted',
        };
      case 'DocumentRetrieval':
        return {
          documentDescription: title,
          retrievalMethod: 'Electronic',
        };
      case 'CourtDate':
        return {
          courtName: 'De specificat',
          caseNumber: 'De specificat',
          hearingType: 'Hearing',
        };
      case 'Meeting':
        return {
          meetingType: 'Internal',
          agenda: description || title,
        };
      case 'BusinessTrip':
        return {
          destination: 'De specificat',
          purpose: title,
          delegationRequired: false,
        };
      default:
        // Fallback to Research as the most flexible type
        return {
          researchTopic: title,
        };
    }
  }

  private async executeListTasks(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const { TaskService } = await import('./task.service');
    const taskService = new TaskService();

    const filters: { statuses?: TaskStatus[]; priorities?: TaskPriority[] } = {};
    const status = input.status as string | undefined;

    if (status && status !== 'all') {
      if (status === 'overdue') {
        filters.statuses = [TaskStatus.Pending, TaskStatus.InProgress];
      } else {
        filters.statuses = [this.mapTaskStatusEnum(status)];
      }
    }

    const tasks = await taskService.getTasksByAssignee(context.userId, context.firmId, filters);

    // Filter by time range
    const timeRange = (input.timeRange as string) || 'week';
    const filteredTasks = this.filterTasksByTimeRange(tasks, timeRange);

    if (filteredTasks.length === 0) {
      return {
        success: true,
        message: 'Nu am găsit sarcini care să corespundă criteriilor.',
        data: { tasks: [] },
      };
    }

    const taskList = filteredTasks
      .slice(0, 5)
      .map((t) => `• ${t.title} (${this.formatDateRomanian(t.dueDate?.toISOString() || '')})`)
      .join('\n');

    return {
      success: true,
      message: `Am găsit ${filteredTasks.length} sarcin${filteredTasks.length === 1 ? 'ă' : 'i'}:\n${taskList}`,
      data: { tasks: filteredTasks },
    };
  }

  private async executeUpdateTask(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const { TaskService } = await import('./task.service');
    const taskService = new TaskService();

    const taskId = input.taskId as string;
    if (!taskId) {
      return {
        success: false,
        message: 'Nu am identificat sarcina de actualizat.',
      };
    }

    const updateData: { status?: TaskStatus; dueDate?: Date; priority?: TaskPriority } = {};
    if (input.status) updateData.status = this.mapTaskStatusEnum(input.status as string);
    if (input.dueDate) updateData.dueDate = new Date(input.dueDate as string);
    if (input.priority) updateData.priority = this.mapPriorityEnum(input.priority as string);

    const task = await taskService.updateTask(taskId, updateData, context.userId);

    return {
      success: true,
      message: `Sarcina "${task.title}" a fost actualizată.`,
      entityId: task.id,
      entityType: 'Task',
    };
  }

  private async executeGetCaseSummary(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;

    if (!caseId) {
      // Try to find by reference
      const caseRef = input.caseReference as string;
      if (caseRef) {
        const foundCase = await prisma.case.findFirst({
          where: {
            firmId: context.firmId,
            OR: [
              { caseNumber: { contains: caseRef, mode: 'insensitive' } },
              { title: { contains: caseRef, mode: 'insensitive' } },
            ],
          },
          select: { id: true, title: true, caseNumber: true, status: true },
        });

        if (foundCase) {
          return {
            success: true,
            message: `Dosar: ${foundCase.title} (${foundCase.caseNumber})\nStatus: ${foundCase.status}`,
            data: foundCase,
          };
        }
      }

      return {
        success: false,
        message: 'Nu am identificat dosarul. Specificați un dosar.',
      };
    }

    const caseData = await prisma.case.findFirst({
      where: { id: caseId, firmId: context.firmId },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        status: true,
        summary: true,
      },
    });

    if (!caseData) {
      return {
        success: false,
        message: 'Dosarul nu a fost găsit.',
      };
    }

    // Get team members separately
    const teamMembers = await prisma.caseTeam.findMany({
      where: { caseId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const teamList = teamMembers
      .map((t) => `${t.user.firstName} ${t.user.lastName} (${t.role})`)
      .join(', ');

    return {
      success: true,
      message: `📁 ${caseData.title}\nNumăr: ${caseData.caseNumber}\nStatus: ${caseData.status}\nEchipă: ${teamList || 'Nealocat'}`,
      data: caseData,
    };
  }

  private async executeSearchCases(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const query = (input.query as string) || '';
    const status = input.status as CaseStatus | undefined;

    console.log('[AIAssistant] executeSearchCases called:', {
      query,
      status,
      firmId: context.firmId,
      inputRaw: JSON.stringify(input),
    });

    // Split query into words for fuzzy matching
    // "TT Solaria ABC" should match "TT Solaria c. ABC Development"
    const queryWords = query
      .split(/\s+/)
      .filter((w) => w.length >= 2) // Skip single chars like "c"
      .map((w) => w.toLowerCase());

    console.log('[AIAssistant] Search words:', queryWords);

    // Build AND conditions - each word must appear in title or caseNumber
    const wordConditions = queryWords.map((word) => ({
      OR: [
        { title: { contains: word, mode: 'insensitive' as const } },
        { caseNumber: { contains: word, mode: 'insensitive' as const } },
        { client: { name: { contains: word, mode: 'insensitive' as const } } },
      ],
    }));

    const cases = await prisma.case.findMany({
      where: {
        firmId: context.firmId,
        ...(status && { status }),
        ...(queryWords.length > 0 && { AND: wordConditions }),
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, caseNumber: true, status: true },
    });

    console.log('[AIAssistant] executeSearchCases result:', {
      count: cases.length,
      cases: cases.map((c) => ({ id: c.id, title: c.title })),
    });

    if (cases.length === 0) {
      return {
        success: true,
        message: 'Nu am găsit dosare care să corespundă criteriilor.',
        data: { cases: [] },
      };
    }

    // Include caseId (UUID) in output so Claude can use them for subsequent tool calls
    // IMPORTANT: Do NOT show caseNumber to avoid confusion - only show the UUID which is required for tool calls
    const caseList = cases.map((c) => `• ${c.title} - ${c.status}\n  caseId: ${c.id}`).join('\n');

    // Always include explicit instruction about using caseId
    const usageHint = `\n\nIMPORTANT: Pentru orice operațiune pe aceste dosare (generare documente, creare sarcini, etc.), folosește valoarea "caseId" de mai sus.`;

    return {
      success: true,
      message: `Am găsit ${cases.length} dosar${cases.length === 1 ? '' : 'e'}:\n${caseList}${usageHint}`,
      data: { cases },
    };
  }

  private async executeGetCaseDeadlines(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;

    if (!caseId) {
      return {
        success: false,
        message: 'Specificați un dosar pentru a vedea termenele.',
      };
    }

    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        firmId: context.firmId,
        dueDate: { gte: now },
        status: { not: 'Completed' },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      select: { id: true, title: true, dueDate: true, priority: true },
    });

    if (tasks.length === 0) {
      return {
        success: true,
        message: 'Nu există termene viitoare pentru acest dosar.',
        data: { deadlines: [] },
      };
    }

    const deadlineList = tasks
      .map((t) => `• ${this.formatDateRomanian(t.dueDate?.toISOString() || '')}: ${t.title}`)
      .join('\n');

    return {
      success: true,
      message: `Termene viitoare:\n${deadlineList}`,
      data: { deadlines: tasks },
    };
  }

  private async executeGetCaseActors(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;

    if (!caseId) {
      return {
        success: false,
        message: 'Specificați un dosar.',
      };
    }

    const actors = await prisma.caseActor.findMany({
      where: { caseId },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
      },
    });

    if (actors.length === 0) {
      return {
        success: true,
        message: 'Nu sunt actori definiți pentru acest dosar.',
        data: { actors: [] },
      };
    }

    const actorList = actors.map((a) => `• ${a.name} (${a.role})`).join('\n');

    return {
      success: true,
      message: `Părți implicate:\n${actorList}`,
      data: { actors },
    };
  }

  private async executeSearchEmails(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const query = (input.query as string) || '';
    const sender = input.sender as string | undefined;
    const caseId = (input.caseId as string) || context.caseId;

    const emails = await prisma.email.findMany({
      where: {
        userId: context.userId,
        ...(caseId && {
          caseLinks: { some: { caseId } },
        }),
        ...(query && {
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { bodyPreview: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { receivedDateTime: 'desc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        from: true,
        receivedDateTime: true,
        bodyPreview: true,
      },
    });

    // Filter by sender if specified
    const filteredEmails = sender
      ? emails.filter((e) => {
          const from = e.from as { address?: string } | null;
          return from?.address?.toLowerCase().includes(sender.toLowerCase());
        })
      : emails;

    if (filteredEmails.length === 0) {
      return {
        success: true,
        message: 'Nu am găsit emailuri care să corespundă criteriilor.',
        data: { emails: [] },
      };
    }

    const emailList = filteredEmails
      .slice(0, 5)
      .map((e) => {
        const from = e.from as { name?: string } | null;
        return `• ${e.subject || '(fără subiect)'} - ${from?.name || 'Necunoscut'}`;
      })
      .join('\n');

    return {
      success: true,
      message: `Am găsit ${filteredEmails.length} emailuri:\n${emailList}`,
      data: { emails: filteredEmails },
    };
  }

  private async executeGetRecentEmails(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const emails = await prisma.email.findMany({
      where: {
        userId: context.userId,
        receivedDateTime: { gte: yesterday },
        isRead: false,
        ...(caseId && {
          caseLinks: { some: { caseId } },
        }),
      },
      orderBy: { receivedDateTime: 'desc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        from: true,
        receivedDateTime: true,
      },
    });

    if (emails.length === 0) {
      return {
        success: true,
        message: 'Nu aveți emailuri noi necitite.',
        data: { emails: [] },
      };
    }

    const emailList = emails
      .slice(0, 5)
      .map((e) => {
        const from = e.from as { name?: string } | null;
        return `• ${e.subject || '(fără subiect)'} - ${from?.name || 'Necunoscut'}`;
      })
      .join('\n');

    return {
      success: true,
      message: `Aveți ${emails.length} emailuri noi:\n${emailList}`,
      data: { emails },
    };
  }

  private async executeSummarizeEmailThread(
    input: Record<string, unknown>,
    _context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const emailId = input.emailId as string | undefined;
    const threadId = input.threadId as string | undefined;

    if (!emailId && !threadId) {
      return {
        success: false,
        message: 'Specificați un email sau thread de rezumat.',
      };
    }

    // For now, return a placeholder - full implementation would use AI summarization
    return {
      success: true,
      message: 'Funcționalitatea de rezumat email thread va fi disponibilă în curând.',
      data: {},
    };
  }

  private async executeDraftEmailReply(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const emailId = input.emailId as string;

    if (!emailId) {
      return {
        success: false,
        message: 'Specificați emailul la care să răspund.',
      };
    }

    const { emailDraftingService } = await import('./email-drafting.service');

    const draft = await emailDraftingService.generateDraft(
      {
        emailId,
        tone: (input.tone as 'Formal' | 'Professional' | 'Brief') || 'Professional',
        recipientType: input.recipientType as 'Client' | 'Court' | 'OpposingCounsel' | 'ThirdParty',
        instructions: input.instructions as string | undefined,
      },
      {
        userId: context.userId,
        firmId: context.firmId,
        accessToken: context.accessToken,
      }
    );

    return {
      success: true,
      message: `Am generat un răspuns. Previzualizare:\n\n${draft.body.substring(0, 200)}...`,
      entityId: draft.id,
      entityType: 'EmailDraft',
      data: draft,
    };
  }

  private async executeSearchDocuments(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const query = (input.query as string) || '';
    const caseId = (input.caseId as string) || context.caseId;

    const documents = await prisma.document.findMany({
      where: {
        firmId: context.firmId,
        ...(caseId && {
          caseLinks: { some: { caseId } },
        }),
        ...(query && {
          fileName: { contains: query, mode: 'insensitive' as const },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fileName: true, createdAt: true },
    });

    if (documents.length === 0) {
      return {
        success: true,
        message: 'Nu am găsit documente care să corespundă criteriilor.',
        data: { documents: [] },
      };
    }

    const docList = documents
      .slice(0, 5)
      .map((d) => `• ${d.fileName}`)
      .join('\n');

    return {
      success: true,
      message: `Am găsit ${documents.length} documente:\n${docList}`,
      data: { documents },
    };
  }

  private async executeListCaseDocuments(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;

    if (!caseId) {
      return {
        success: false,
        message: 'Specificați un dosar.',
      };
    }

    const documents = await prisma.document.findMany({
      where: {
        firmId: context.firmId,
        caseLinks: { some: { caseId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, fileName: true, createdAt: true, status: true },
    });

    if (documents.length === 0) {
      return {
        success: true,
        message: 'Nu există documente în acest dosar.',
        data: { documents: [] },
      };
    }

    const docList = documents
      .slice(0, 10)
      .map((d) => `• ${d.fileName}`)
      .join('\n');

    return {
      success: true,
      message: `Documentele dosarului (${documents.length}):\n${docList}`,
      data: { documents },
    };
  }

  private async executeSummarizeDocument(
    input: Record<string, unknown>,
    _context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const documentId = input.documentId as string;

    if (!documentId) {
      return {
        success: false,
        message: 'Specificați documentul de rezumat.',
      };
    }

    // Placeholder - full implementation would use AI summarization
    return {
      success: true,
      message: 'Funcționalitatea de rezumat document va fi disponibilă în curând.',
      data: {},
    };
  }

  /**
   * Execute document generation with .docx creation and SharePoint upload
   * OPS-256: Creates .docx file and uploads to SharePoint
   */
  private async executeGenerateDocument(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const { documentGenerationService } = await import('./document-generation.service');
    const { docxGeneratorService } = await import('./docx-generator.service');
    const { sharePointService } = await import('./sharepoint.service');

    const templateType = (input.templateType as string) || 'Other';
    const caseId = (input.caseId as string) || context.caseId;
    const instructions = (input.instructions as string) || `Generează ${templateType}`;

    // Generate the document content (markdown)
    const generatedDoc = await documentGenerationService.generateDocument(
      {
        type: templateType as 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other',
        caseId,
        instructions,
      },
      {
        userId: context.userId,
        firmId: context.firmId,
      }
    );

    // Save document to database and upload to SharePoint if we have a case and accessToken
    let savedDocumentId: string | undefined;
    let navigationUrl: string | undefined;
    let wordUrl: string | undefined;

    if (caseId && context.accessToken) {
      try {
        // Get the case to find the client and case number
        const caseData = await prisma.case.findFirst({
          where: { id: caseId, firmId: context.firmId },
          select: { clientId: true, title: true, caseNumber: true },
        });

        // Get firm name for document header
        const firm = await prisma.firm.findUnique({
          where: { id: context.firmId },
          select: { name: true },
        });

        // Get user name for document metadata
        const user = await prisma.user.findUnique({
          where: { id: context.userId },
          select: { firstName: true, lastName: true },
        });
        const authorName = user ? `${user.firstName} ${user.lastName}` : 'Legal Platform';

        if (caseData?.clientId && caseData?.caseNumber) {
          // Generate .docx file
          const docxBuffer = await docxGeneratorService.markdownToDocx(
            generatedDoc.content,
            {
              title: generatedDoc.title,
              author: authorName,
              subject: caseData.title,
              creator: 'Legal Platform AI',
              lastModifiedBy: authorName,
            },
            {
              includePageNumbers: true,
              headerText: firm?.name,
            }
          );

          // Generate .docx filename
          const timestamp = new Date().toISOString().split('T')[0];
          const sanitizedTitle = generatedDoc.title
            .toLowerCase()
            .replace(/[^a-z0-9ăâîșț\s-]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
          const docxFileName = `${sanitizedTitle}-${timestamp}.docx`;

          // Upload to SharePoint
          const sharePointItem = await sharePointService.uploadDocument(
            context.accessToken,
            caseData.caseNumber,
            docxFileName,
            docxBuffer,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );

          // Create the document record with SharePoint reference
          const document = await prisma.document.create({
            data: {
              clientId: caseData.clientId,
              firmId: context.firmId,
              fileName: docxFileName,
              fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              fileSize: docxBuffer.length,
              storagePath: sharePointItem.parentPath + '/' + docxFileName,
              sharePointItemId: sharePointItem.id,
              sharePointPath: sharePointItem.parentPath,
              sharePointLastModified: new Date(sharePointItem.lastModifiedDateTime),
              uploadedBy: context.userId,
              status: 'DRAFT',
              sourceType: 'AI_GENERATED',
              metadata: {
                generatedBy: 'ai-assistant',
                documentType: generatedDoc.documentType,
                title: generatedDoc.title,
                tokensUsed: generatedDoc.tokensUsed,
                generatedAt: new Date().toISOString(),
                sharePointWebUrl: sharePointItem.webUrl,
              },
            },
          });

          // Link document to case
          await prisma.caseDocument.create({
            data: {
              caseId,
              documentId: document.id,
              linkedBy: context.userId,
              firmId: context.firmId,
              isOriginal: true,
            },
          });

          savedDocumentId = document.id;
          navigationUrl = `/cases/${caseId}/documents?documentId=${document.id}`;
          wordUrl = `ms-word:ofe|u|${sharePointItem.webUrl}`;

          console.log(
            `[AIAssistant] Document created and uploaded to SharePoint: ${document.id} for case ${caseId}`
          );
        }
      } catch (error) {
        console.error('[AIAssistant] Error creating/uploading document:', error);
        // Continue - we still have the generated content to return
      }
    } else if (caseId && !context.accessToken) {
      console.warn('[AIAssistant] No accessToken available for SharePoint upload');
    }

    // Build response message with the document content
    const contentPreview =
      generatedDoc.content.length > 2000
        ? generatedDoc.content.substring(0, 2000) +
          '\n\n... [Document trunchiat - vezi în dosar pentru versiunea completă]'
        : generatedDoc.content;

    // Build message based on outcome
    let message: string;
    if (savedDocumentId && wordUrl) {
      message =
        `Am generat și salvat documentul "${generatedDoc.title}" în SharePoint.\n\n` +
        `📄 **Fișier:** ${generatedDoc.title}.docx\n` +
        `📂 **Locație:** Dosar > Documente\n\n` +
        `---\n\n${contentPreview}`;
    } else if (savedDocumentId) {
      message = `Am generat și salvat documentul "${generatedDoc.title}" în dosarul selectat.\n\n---\n\n${contentPreview}`;
    } else {
      message = `Am generat documentul "${generatedDoc.title}".\n\n---\n\n${contentPreview}`;
    }

    return {
      success: true,
      message,
      entityId: savedDocumentId || generatedDoc.suggestedFileName,
      entityType: 'Document',
      navigationUrl,
      data: generatedDoc,
    };
  }

  private async executeGetCalendar(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const startDate = input.startDate ? new Date(input.startDate as string) : new Date();
    const endDate = input.endDate
      ? new Date(input.endDate as string)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Get tasks as calendar events
    const tasks = await prisma.task.findMany({
      where: {
        firmId: context.firmId,
        assignedTo: context.userId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'Completed' },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        dueDate: true,
        type: true,
        case: { select: { title: true } },
      },
    });

    if (tasks.length === 0) {
      return {
        success: true,
        message: 'Nu aveți evenimente în această perioadă.',
        data: { events: [] },
      };
    }

    const eventList = tasks
      .slice(0, 10)
      .map((t) => `• ${this.formatDateRomanian(t.dueDate?.toISOString() || '')}: ${t.title}`)
      .join('\n');

    return {
      success: true,
      message: `Programul dvs.:\n${eventList}`,
      data: { events: tasks },
    };
  }

  private async executeCreateCalendarEvent(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const { TaskService } = await import('./task.service');
    const taskService = new TaskService();

    const title = input.title as string;
    const startTime = input.startTime as string;

    console.log('[AIAssistant] executeCreateCalendarEvent input:', JSON.stringify(input));
    console.log('[AIAssistant] startTime raw:', startTime);

    if (!title || !startTime) {
      return {
        success: false,
        message: 'Specificați titlul și ora evenimentului.',
      };
    }

    // Parse the start time - treat as Romania local time (Europe/Bucharest)
    // Claude sends ISO format without timezone, which should be interpreted as Bucharest time
    let startDateTime: Date;

    console.log('[AIAssistant] startTime raw from Claude:', startTime);

    if (startTime.includes('T') && !startTime.includes('+') && !startTime.endsWith('Z')) {
      // ISO format without timezone - interpret as Bucharest local time
      // Parse components and create proper Date
      const [datePart, timePart] = startTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second = 0] = (timePart || '00:00:00')
        .split(':')
        .map((s) => parseInt(s, 10));

      console.log('[AIAssistant] Parsed components:', { year, month, day, hour, minute, second });

      // Get the current offset for Bucharest at this specific date (handles DST)
      const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Use noon to avoid DST edge cases
      const bucharestOffset = -getTimezoneOffset('Europe/Bucharest', testDate);

      console.log('[AIAssistant] Bucharest offset (minutes):', bucharestOffset);

      // Create UTC timestamp by subtracting the Bucharest offset
      const utcMs =
        Date.UTC(year, month - 1, day, hour, minute, second) - bucharestOffset * 60 * 1000;
      startDateTime = new Date(utcMs);
    } else {
      startDateTime = new Date(startTime);
    }

    console.log('[AIAssistant] startDateTime parsed (UTC):', startDateTime.toISOString());
    console.log(
      '[AIAssistant] startDateTime (Bucharest):',
      startDateTime.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })
    );

    // Determine task type based on event nature (default to Meeting)
    const eventType = (input.eventType as string)?.toLowerCase() || 'meeting';
    let taskType: 'Meeting' | 'BusinessTrip' | 'CourtDate' = 'Meeting';
    if (
      eventType.includes('deplasare') ||
      eventType.includes('trip') ||
      eventType.includes('travel')
    ) {
      taskType = 'BusinessTrip';
    } else if (
      eventType.includes('instanță') ||
      eventType.includes('court') ||
      eventType.includes('termen')
    ) {
      taskType = 'CourtDate';
    }

    // Get caseId - use context or find a default case
    let caseId = (input.caseId as string) || context.caseId;
    if (!caseId) {
      // Get user's firmId from database (same as TaskService validation)
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { firmId: true },
      });

      if (!user?.firmId) {
        return {
          success: false,
          message: 'Utilizatorul nu aparține unei firme.',
        };
      }

      // Find a default case for the user's firm (first active case)
      const defaultCase = await prisma.case.findFirst({
        where: { firmId: user.firmId, status: 'Active' },
        select: { id: true },
      });
      if (!defaultCase) {
        return {
          success: false,
          message: 'Nu există un dosar activ în care să adaug evenimentul. Specificați un dosar.',
        };
      }
      caseId = defaultCase.id;
    }

    try {
      const description = (input.description as string) || '';
      // Extract time in HH:MM format for Romania timezone
      const dueTime = startDateTime.toLocaleTimeString('ro-RO', {
        timeZone: 'Europe/Bucharest',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      console.log('[AIAssistant] dueTime extracted:', dueTime);

      const taskInput: TaskServiceInput = {
        title,
        description,
        caseId,
        assignedTo: context.userId,
        dueDate: startDateTime,
        dueTime,
        priority: 'Medium',
        type: taskType,
        typeMetadata: this.getDefaultTypeMetadata(taskType, title, description),
      };

      const task = await taskService.createTask(taskInput, context.userId);

      const formattedDate = startDateTime.toLocaleDateString('ro-RO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        success: true,
        message: `Evenimentul "${title}" a fost programat pentru ${formattedDate}.`,
        entityId: task.id,
        entityType: 'Task',
        navigationUrl: `/tasks`,
      };
    } catch (error) {
      console.error('[AIAssistant] Error creating calendar event as task:', error);
      return {
        success: false,
        message: `Nu s-a putut programa evenimentul: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
      };
    }
  }

  private async executeGetMorningBriefing(context: AssistantContext): Promise<ToolExecutionResult> {
    const { briefingHandler } = await import('./intent-handlers/briefing.handler');

    const result = await briefingHandler.getMorningBriefing({
      userId: context.userId,
      firmId: context.firmId,
    });

    const data = result.data as
      | {
          urgentTasks?: { title: string }[];
          todayTasks?: { title: string }[];
          upcomingDeadlines?: { title: string; dueDate: string }[];
          unreadEmailsCount?: number;
        }
      | undefined;

    const urgentCount = data?.urgentTasks?.length || 0;
    const todayCount = data?.todayTasks?.length || 0;
    const emailCount = data?.unreadEmailsCount || 0;

    let message = '☀️ Bună dimineața!\n\n';

    if (urgentCount > 0) {
      message += `🔴 ${urgentCount} sarcin${urgentCount === 1 ? 'ă urgentă' : 'i urgente'}\n`;
    }
    if (todayCount > 0) {
      message += `📋 ${todayCount} sarcin${todayCount === 1 ? 'ă pentru azi' : 'i pentru azi'}\n`;
    }
    if (emailCount > 0) {
      message += `📧 ${emailCount} email${emailCount === 1 ? ' nou' : '-uri noi'}\n`;
    }

    if (urgentCount === 0 && todayCount === 0 && emailCount === 0) {
      message += 'Nu aveți sarcini urgente sau emailuri noi. Zi productivă!';
    }

    return {
      success: true,
      message,
      data: result.data,
    };
  }

  private async executeGetProactiveAlerts(
    input: Record<string, unknown>,
    context: AssistantContext
  ): Promise<ToolExecutionResult> {
    const caseId = (input.caseId as string) || context.caseId;
    const now = new Date();
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Get upcoming deadlines
    const deadlines = await prisma.task.findMany({
      where: {
        firmId: context.firmId,
        assignedTo: context.userId,
        dueDate: { gte: now, lte: threeDays },
        status: { not: 'Completed' },
        ...(caseId && { caseId }),
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { id: true, title: true, dueDate: true, priority: true },
    });

    // Get overdue tasks
    const overdue = await prisma.task.findMany({
      where: {
        firmId: context.firmId,
        assignedTo: context.userId,
        dueDate: { lt: now },
        status: { not: 'Completed' },
        ...(caseId && { caseId }),
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { id: true, title: true, dueDate: true, priority: true },
    });

    let message = '';

    if (overdue.length > 0) {
      message += `⚠️ ${overdue.length} sarcin${overdue.length === 1 ? 'ă restantă' : 'i restante'}\n`;
      overdue.forEach((t) => {
        message += `  • ${t.title}\n`;
      });
    }

    if (deadlines.length > 0) {
      message += `📅 ${deadlines.length} termen${deadlines.length === 1 ? ' apropiat' : 'e apropiate'}\n`;
      deadlines.forEach((t) => {
        message += `  • ${t.title} (${this.formatDateRomanian(t.dueDate?.toISOString() || '')})\n`;
      });
    }

    if (overdue.length === 0 && deadlines.length === 0) {
      message = 'Nu aveți alerte active momentan.';
    }

    return {
      success: true,
      message,
      data: { overdue, deadlines },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async buildContextualSystemPrompt(context: AssistantContext): Promise<string> {
    // Import context services
    const { userContextService } = await import('./user-context.service');
    const { caseBriefingService } = await import('./case-briefing.service');

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { firstName: true, lastName: true, role: true, firmId: true },
    });

    const userName = user ? `${user.firstName} ${user.lastName}` : 'Utilizator';
    const userRole = user?.role || 'Lawyer';

    // Get case name if in case context
    let caseName: string | undefined;
    if (context.caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: context.caseId },
        select: { title: true },
      });
      caseName = caseData?.title;
    }

    // OPS-117: Get pre-computed user daily context
    let userDailyContext: string | undefined;
    try {
      userDailyContext = await userContextService.getContextForPrompt(
        context.userId,
        context.firmId
      );
    } catch (err) {
      console.error('[AIAssistant] Failed to load user daily context:', err);
      // Continue without context - non-blocking
    }

    // OPS-262: Try to get pre-compiled rich context first, fall back to on-demand
    let caseBriefing: string | undefined;
    if (context.caseId) {
      try {
        // Try pre-compiled rich context first
        const richContext = await caseBriefingService.getRichContext(context.caseId);

        if (richContext && caseBriefingService.isContextFresh(richContext)) {
          // Use pre-compiled comprehensive context
          caseBriefing = caseBriefingService.formatRichContext(richContext);
          console.log('[AIAssistant] Using pre-compiled context', {
            caseId: context.caseId,
            contextAge: caseBriefingService.getContextAge(richContext),
            version: richContext.contextVersion,
            hasDocSummaries: richContext.documentSummaries?.length || 0,
            hasEmailSummaries: richContext.emailThreadSummaries?.length || 0,
            hasClientContext: !!richContext.clientContext,
          });
        } else if (richContext) {
          // Rich context exists but is stale - fall back to on-demand
          console.log('[AIAssistant] Pre-compiled context stale, using on-demand', {
            caseId: context.caseId,
            contextAge: caseBriefingService.getContextAge(richContext),
          });
          caseBriefing = await caseBriefingService.getBriefingText(context.caseId);
        } else {
          // No pre-compiled context available - use on-demand
          console.log('[AIAssistant] No pre-compiled context, using on-demand', {
            caseId: context.caseId,
          });
          caseBriefing = await caseBriefingService.getBriefingText(context.caseId);
        }
      } catch (err) {
        console.error('[AIAssistant] Failed to load case briefing:', err);
        // Continue without briefing - non-blocking
      }
    }

    return buildSystemPrompt({
      currentDate: getCurrentDateISO(),
      userName,
      userRole,
      caseId: context.caseId,
      caseName: caseName || context.caseName,
      userDailyContext,
      caseBriefing,
    });
  }

  private async getCaseName(caseId: string, firmId: string): Promise<string> {
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { title: true },
    });
    return caseData?.title || 'Dosar necunoscut';
  }

  private getSuggestedFollowUps(toolName: AIToolName | null): string[] {
    if (!toolName) {
      return ['Creează o sarcină', 'Briefing zilnic', 'Ajutor'];
    }

    const followUps: Record<string, string[]> = {
      create_task: ['Listează sarcinile', 'Adaugă altă sarcină', 'Vezi dosarul'],
      list_tasks: ['Creează o sarcină', 'Filtrează după prioritate'],
      get_case_summary: ['Vezi termenele', 'Vezi documentele', 'Vezi emailurile'],
      search_emails: ['Răspunde la email', 'Caută alt email'],
      get_morning_briefing: ['Vezi sarcinile urgente', 'Programează întâlnire'],
    };

    return followUps[toolName] || ['Ajutor', 'Altă întrebare'];
  }

  private getPostActionFollowUps(toolName: AIToolName): string[] {
    const followUps: Record<string, string[]> = {
      create_task: ['Vezi sarcina', 'Adaugă altă sarcină', 'Setează reminder'],
      update_task: ['Vezi sarcinile', 'Marchează finalizat'],
      draft_email_reply: ['Editează răspunsul', 'Trimite emailul'],
      generate_document: ['Editează documentul', 'Salvează în dosar'],
      create_calendar_event: ['Vezi calendarul', 'Adaugă alt eveniment'],
    };

    return followUps[toolName] || ['Altă acțiune', 'Ajutor'];
  }

  // ============================================================================
  // Formatting & Translation Helpers
  // ============================================================================

  private formatDateRomanian(isoDate: string): string {
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

  private formatDateTimeRomanian(isoDateTime: string): string {
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

  private translatePriority(priority: string): string {
    const map: Record<string, string> = {
      Low: 'scăzută',
      Medium: 'medie',
      High: 'ridicată',
      Urgent: 'urgentă',
    };
    return map[priority] || priority.toLowerCase();
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'în așteptare',
      in_progress: 'în lucru',
      completed: 'finalizate',
      overdue: 'restante',
      all: 'toate',
    };
    return map[status] || status;
  }

  private translateTimeRange(range: string): string {
    const map: Record<string, string> = {
      today: 'azi',
      week: 'săptămâna aceasta',
      month: 'luna aceasta',
      all: 'toate',
    };
    return map[range] || range;
  }

  private translateTone(tone: string): string {
    const map: Record<string, string> = {
      formal: 'formal',
      professional: 'profesional',
      brief: 'concis',
    };
    return map[tone] || tone;
  }

  private translateDocType(docType: string): string {
    const map: Record<string, string> = {
      Contract: 'contract',
      Motion: 'cerere',
      Letter: 'scrisoare',
      Memo: 'memoriu',
      Pleading: 'act de procedură',
      Other: 'document',
    };
    return map[docType] || docType.toLowerCase();
  }

  private mapPriority(priority: string | undefined): string {
    if (!priority) return 'Medium';
    const map: Record<string, string> = {
      Low: 'Low',
      Medium: 'Medium',
      High: 'High',
      Urgent: 'Urgent',
    };
    return map[priority] || 'Medium';
  }

  private mapTaskStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'InProgress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return map[status] || 'Pending';
  }

  private mapTaskType(taskType: string | undefined): string {
    if (!taskType) return 'Meeting';
    const map: Record<string, string> = {
      Research: 'Research',
      Drafting: 'DocumentCreation',
      Review: 'DocumentRetrieval',
      Filing: 'DocumentCreation',
      Communication: 'Meeting',
      Meeting: 'Meeting',
      Deadline: 'CourtDate',
      Other: 'Meeting',
    };
    return map[taskType] || 'Meeting';
  }

  private mapPriorityEnum(priority: string | undefined): TaskPriority {
    if (!priority) return TaskPriority.Medium;
    const map: Record<string, TaskPriority> = {
      Low: TaskPriority.Low,
      Medium: TaskPriority.Medium,
      High: TaskPriority.High,
      Urgent: TaskPriority.Urgent,
    };
    return map[priority] || TaskPriority.Medium;
  }

  private mapTaskStatusEnum(status: string): TaskStatus {
    const map: Record<string, TaskStatus> = {
      pending: TaskStatus.Pending,
      in_progress: TaskStatus.InProgress,
      completed: TaskStatus.Completed,
      cancelled: TaskStatus.Cancelled,
    };
    return map[status] || TaskStatus.Pending;
  }

  private mapTaskTypeEnum(taskType: string | undefined): TaskType {
    if (!taskType) return 'Research'; // Default to Research - simplest metadata requirement
    const map: Record<string, TaskType> = {
      Research: 'Research',
      Drafting: 'DocumentCreation',
      Review: 'DocumentRetrieval',
      Filing: 'DocumentCreation',
      Communication: 'Meeting',
      Meeting: 'Meeting',
      Deadline: 'CourtDate',
      Other: 'Research', // Default to Research - simplest metadata requirement
    };
    return map[taskType] || 'Research';
  }

  private filterTasksByTimeRange(
    tasks: Array<{ dueDate: Date | null; [key: string]: unknown }>,
    timeRange: string
  ): Array<{ dueDate: Date | null; [key: string]: unknown }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeRange) {
      case 'today': {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
      }
      case 'week': {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < nextWeek);
      }
      case 'month': {
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < nextMonth);
      }
      default:
        return tasks;
    }
  }
}

// Export singleton instance
export const aiAssistantService = new AIAssistantService();
