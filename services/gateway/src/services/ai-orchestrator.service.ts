/**
 * AI Orchestrator Service
 * OPS-066: AI Orchestrator Service
 *
 * Central orchestrator for the AI assistant. Processes user messages,
 * detects intents, routes to handlers, and generates responses.
 */

import { AIOperationType, ClaudeModel } from '@legal-platform/types';
import { aiService } from './ai.service';
import { caseSummaryService } from './case-summary.service';
import { emailDraftingService } from './email-drafting.service';
import { documentGenerationService } from './document-generation.service';
import { morningBriefingService } from './morning-briefing.service';
import { TaskService } from './task.service';
import { searchService, SearchMode } from './search.service';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '@legal-platform/database';
import { taskIntentHandler } from './intent-handlers/task.handler';
import { caseQueryHandler } from './intent-handlers/case-query.handler';
import { emailIntentHandler } from './intent-handlers/email.handler';
import { documentIntentHandler } from './intent-handlers/document.handler';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for assistant errors with user-friendly messages.
 * Includes error code, Romanian user message, and recovery status.
 */
export class AssistantError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public recoverable: boolean = true
  ) {
    super(userMessage);
    this.name = 'AssistantError';
  }
}

/**
 * Error codes for categorizing assistant errors.
 */
export enum AssistantErrorCode {
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  SERVICE_ERROR = 'SERVICE_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  NOT_FOUND = 'NOT_FOUND',
  NO_PERMISSION = 'NO_PERMISSION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTEXT_LOST = 'CONTEXT_LOST',
  INVALID_INPUT = 'INVALID_INPUT',
}

/**
 * Romanian user-facing error messages.
 */
export const ERROR_MESSAGES: Record<AssistantErrorCode, string> = {
  [AssistantErrorCode.LOW_CONFIDENCE]: 'Nu am înțeles exact ce doriți. Puteți reformula?',
  [AssistantErrorCode.SERVICE_ERROR]: 'A apărut o eroare temporară. Încercați din nou.',
  [AssistantErrorCode.RATE_LIMIT]: 'Prea multe cereri. Vă rugăm așteptați câteva secunde.',
  [AssistantErrorCode.NOT_FOUND]: 'Nu am găsit informația cerută.',
  [AssistantErrorCode.NO_PERMISSION]: 'Nu aveți permisiunea necesară pentru această acțiune.',
  [AssistantErrorCode.NETWORK_ERROR]: 'Verificați conexiunea la internet.',
  [AssistantErrorCode.CONTEXT_LOST]: 'Am pierdut contextul conversației. Să reluăm?',
  [AssistantErrorCode.INVALID_INPUT]: 'Datele introduse nu sunt valide.',
};

// ============================================================================
// Types
// ============================================================================

export enum AssistantIntent {
  // Task & Calendar
  CreateTask = 'CreateTask',
  UpdateTask = 'UpdateTask',
  QueryTasks = 'QueryTasks',
  ScheduleEvent = 'ScheduleEvent',

  // Case Information
  CaseQuery = 'CaseQuery',
  CaseSummary = 'CaseSummary',

  // Communication
  SearchEmails = 'SearchEmails',
  SummarizeThread = 'SummarizeThread',
  DraftEmail = 'DraftEmail',

  // Document Operations
  FindDocument = 'FindDocument',
  SummarizeDocument = 'SummarizeDocument',
  GenerateDocument = 'GenerateDocument',

  // Proactive
  MorningBriefing = 'MorningBriefing',
  DeadlineAlert = 'DeadlineAlert',

  // General
  AskClarification = 'AskClarification',
  GeneralChat = 'GeneralChat',
}

export interface AssistantContext {
  currentScreen?: string;
  currentCaseId?: string;
  currentDocumentId?: string;
  selectedEmailId?: string;
  selectedText?: string;
}

export interface UserContext {
  userId: string;
  firmId: string;
  role: string;
  email: string;
  accessToken?: string;
}

export interface ProposedAction {
  type: string;
  displayText: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  entityPreview?: Record<string, unknown>;
}

export interface AIMessage {
  role: 'User' | 'Assistant' | 'System';
  content: string;
  createdAt?: Date;
}

export interface OrchestratorResult {
  intent: AssistantIntent;
  confidence: number;
  response: string;
  proposedAction?: ProposedAction;
  suggestedFollowUps: string[];
}

interface IntentDetectionResult {
  intent: AssistantIntent;
  confidence: number;
  params: Record<string, unknown>;
}

interface HandlerResult {
  result: unknown;
  proposedAction?: ProposedAction;
}

// ============================================================================
// Constants
// ============================================================================

const INTENT_DETECTION_PROMPT = `Ești un asistent juridic AI pentru o firmă de avocatură din România.
Analizează mesajul utilizatorului și detectează intenția. Răspunde în română.

Mesaj: "{message}"
Context curent: {context}
Istoric conversație: {history}

INTENȚII DISPONIBILE (în ordinea probabilității):

1. CreateTask - Crearea unei sarcini noi
   Exemple: "creează o sarcină", "adaugă task", "fă-mi un reminder", "vreau să adaug o sarcină",
   "să-mi amintesc să...", "trebuie să...", "notează-mi că trebuie să..."

2. QueryTasks - Întrebări despre sarcini
   Exemple: "ce sarcini am", "ce am de făcut", "arată-mi sarcinile", "taskurile mele",
   "ce e urgent", "ce termene am", "sarcini pentru azi/mâine/săptămâna asta"

3. CaseQuery - Întrebări generale despre dosar
   Exemple: "care e statusul dosarului", "spune-mi despre dosar", "ce se întâmplă în dosar"

4. CaseSummary - Cerere de rezumat dosar
   Exemple: "fă-mi un rezumat", "rezumatul dosarului", "rezumă dosarul", "sumar dosar"

5. SearchEmails - Căutare emailuri
   Exemple: "găsește email", "caută emailul", "email de la X", "mesajul de ieri", "ce emailuri am"

6. DraftEmail - Redactare email
   Exemple: "scrie un email", "redactează răspuns", "compune email", "ajută-mă să răspund"

7. SummarizeThread - Rezumat conversație email
   Exemple: "rezumă conversația", "rezumat email", "despre ce e vorba în email"

8. FindDocument - Căutare documente
   Exemple: "găsește document", "unde e contractul", "caută fișier", "documente despre"

9. SummarizeDocument - Rezumat document
   Exemple: "rezumă documentul", "ce zice în document", "analizează contractul"

10. GenerateDocument - Generare document nou
    Exemple: "generează contract", "creează document", "scrie o cerere", "întâmpinare nouă"

11. MorningBriefing - Briefing zilnic
    Exemple: "briefing", "ce am pe azi", "sumar zilnic", "programul de azi"

12. DeadlineAlert - Termene și deadline-uri
    Exemple: "ce termene am", "deadline-uri", "termene apropiate", "când e următorul termen"

13. ScheduleEvent - Programare eveniment/întâlnire
    Exemple: "programează întâlnire", "adaugă în calendar", "eveniment nou"

14. GeneralChat - Conversație generală (DOAR când nu se potrivește nimic)
    Exemple: "bună ziua", "mulțumesc", întrebări nespecifice

IMPORTANT: Alege intenția care se potrivește cel mai bine, nu GeneralChat decât dacă chiar nu există o potrivire.

Răspunde DOAR cu JSON valid:
{
  "intent": "<intent_name>",
  "confidence": <0.0-1.0>,
  "params": {
    "taskTitle": "<titlu sarcină dacă e relevant>",
    "caseId": "<id dosar dacă menționat>",
    "searchQuery": "<termeni de căutare dacă e relevant>",
    "documentType": "<tip document dacă e relevant>",
    "emailSubject": "<subiect email dacă e relevant>",
    "priority": "<urgent|high|medium|low dacă e menționat>",
    "dueDate": "<YYYY-MM-DD dacă e menționat>",
    "timeRange": "<today|week|month dacă e menționat>"
  },
  "reasoning": "<explicație scurtă>"
}`;

const RESPONSE_GENERATION_PROMPT = `Ești un asistent juridic prietenos și profesionist pentru avocați români.
Generează un răspuns natural bazat pe rezultatul acțiunii.

INTENT: {intent}
REZULTAT: {result}
CONTEXT: {context}
LIMBA: Română

Reguli:
- Răspunde CONCIS și DIRECT
- Folosește un ton profesionist dar prietenos
- Dacă ai întrebări de clarificare, pune-le
- Dacă ai sugestii de acțiuni ulterioare, menționează-le

Răspunde DOAR cu textul răspunsului, fără JSON sau formatare specială.`;

// ============================================================================
// Service
// ============================================================================

export class AIOrchestratorService {
  private taskService: TaskService;

  constructor() {
    this.taskService = new TaskService();
  }

  /**
   * Main entry point - process a user message.
   * Includes comprehensive error handling with user-friendly Romanian messages.
   */
  async processMessage(
    message: string,
    context: AssistantContext,
    conversationHistory: AIMessage[],
    userContext: UserContext
  ): Promise<OrchestratorResult> {
    try {
      // 1. Detect intent using Claude Haiku for speed
      const intentResult = await this.detectIntent(message, context, conversationHistory);

      // 2. Handle low confidence - ask for clarification with suggestions
      // Use 0.35 threshold to allow more commands through while still catching truly ambiguous ones
      if (intentResult.confidence < 0.35) {
        return this.handleLowConfidence(
          message,
          intentResult.intent,
          intentResult.confidence,
          intentResult.params
        );
      }

      // 3. Route to appropriate handler (pass original message for NL processing)
      const handlerResult = await this.routeIntent(
        intentResult.intent,
        { ...intentResult.params, rawMessage: message },
        context,
        userContext
      );

      // 4. Generate natural language response
      const response = await this.generateResponse(
        intentResult.intent,
        handlerResult.result,
        context,
        'ro'
      );

      // 5. Get suggested follow-ups
      const suggestedFollowUps = this.getSuggestedFollowUps(
        intentResult.intent,
        handlerResult.result
      );

      return {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        response,
        proposedAction: handlerResult.proposedAction,
        suggestedFollowUps,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle low confidence intent detection.
   * Generates clarification options based on the detected intent.
   */
  private handleLowConfidence(
    message: string,
    intent: AssistantIntent,
    confidence: number,
    params: Record<string, unknown>
  ): OrchestratorResult {
    const suggestions = this.generateClarificationOptions(intent, params);

    console.log('[Orchestrator] Low confidence:', { message, intent, confidence, suggestions });

    return {
      intent: AssistantIntent.AskClarification,
      confidence,
      response: `Nu sunt sigur că am înțeles corect. Ați vrut să:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nSau altceva?`,
      suggestedFollowUps: suggestions,
    };
  }

  /**
   * Handle errors and return user-friendly responses.
   * Categorizes errors and provides appropriate recovery suggestions.
   */
  private handleError(error: unknown): OrchestratorResult {
    console.error('[Orchestrator] Assistant error:', error);

    // Handle our custom AssistantError
    if (error instanceof AssistantError) {
      return {
        intent: AssistantIntent.GeneralChat,
        confidence: 1,
        response: error.userMessage,
        suggestedFollowUps: error.recoverable ? ['Încercați din nou', 'Ajutor'] : [],
      };
    }

    // Handle standard errors with pattern matching
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limiting errors
      if (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('too many requests')
      ) {
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 1,
          response: ERROR_MESSAGES[AssistantErrorCode.RATE_LIMIT],
          suggestedFollowUps: [],
        };
      }

      // Network/timeout errors
      if (
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('network') ||
        message.includes('fetch')
      ) {
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 1,
          response: ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR],
          suggestedFollowUps: ['Încercați din nou'],
        };
      }

      // Service unavailable
      if (
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('overloaded')
      ) {
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 1,
          response: ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR],
          suggestedFollowUps: ['Încercați din nou'],
        };
      }

      // Permission errors
      if (
        message.includes('permission') ||
        message.includes('unauthorized') ||
        message.includes('403') ||
        message.includes('forbidden')
      ) {
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 1,
          response: ERROR_MESSAGES[AssistantErrorCode.NO_PERMISSION],
          suggestedFollowUps: [],
        };
      }

      // Not found errors
      if (
        message.includes('not found') ||
        message.includes('404') ||
        message.includes('nu există')
      ) {
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 1,
          response: ERROR_MESSAGES[AssistantErrorCode.NOT_FOUND],
          suggestedFollowUps: ['Căutați altceva', 'Ajutor'],
        };
      }
    }

    // Generic fallback for unknown errors
    return {
      intent: AssistantIntent.GeneralChat,
      confidence: 1,
      response: ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR],
      suggestedFollowUps: ['Încercați din nou', 'Contactați suportul'],
    };
  }

  /**
   * Generate clarification options based on detected intent.
   */
  private generateClarificationOptions(
    intent: AssistantIntent,
    _params: Record<string, unknown>
  ): string[] {
    switch (intent) {
      case AssistantIntent.CreateTask:
        return ['Creați o sarcină nouă', 'Vedeți sarcinile existente', 'Modificați o sarcină'];
      case AssistantIntent.UpdateTask:
        return ['Modificați o sarcină', 'Vedeți sarcinile mele', 'Finalizați o sarcină'];
      case AssistantIntent.QueryTasks:
        return ['Vedeți sarcinile deschise', 'Vedeți sarcinile urgente', 'Căutați o sarcină'];
      case AssistantIntent.CaseQuery:
      case AssistantIntent.CaseSummary:
        return ['Rezumatul dosarului', 'Statusul dosarului', 'Termenele din dosar'];
      case AssistantIntent.SearchEmails:
        return ['Căutați un email', 'Vedeți emailurile recente', 'Redactați un email'];
      case AssistantIntent.DraftEmail:
        return ['Redactați un răspuns', 'Compuneți un email nou', 'Vedeți draft-urile'];
      case AssistantIntent.FindDocument:
      case AssistantIntent.SummarizeDocument:
        return ['Găsiți un document', 'Rezumați un document', 'Creați un document'];
      case AssistantIntent.GenerateDocument:
        return ['Generați un contract', 'Generați o cerere', 'Generați o scrisoare'];
      default:
        return ['Creați o sarcină', 'Căutați în dosar', 'Vedeți emailurile'];
    }
  }

  /**
   * Detect intent from user message.
   * Uses Claude Haiku for speed and cost efficiency.
   */
  private async detectIntent(
    message: string,
    context: AssistantContext,
    history: AIMessage[]
  ): Promise<IntentDetectionResult> {
    try {
      const historyText = history
        .slice(-5) // Last 5 messages for context
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const contextText = JSON.stringify({
        screen: context.currentScreen || 'unknown',
        caseId: context.currentCaseId || 'none',
        documentId: context.currentDocumentId || 'none',
        emailId: context.selectedEmailId || 'none',
      });

      const prompt = INTENT_DETECTION_PROMPT.replace('{message}', message)
        .replace('{context}', contextText)
        .replace('{history}', historyText || 'Nu există istoric');

      const response = await aiService.generate({
        prompt,
        operationType: AIOperationType.TaskParsing,
        modelOverride: ClaudeModel.Haiku,
        firmId: 'system', // Intent detection is system-level
        maxTokens: 500,
        temperature: 0.1,
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[Orchestrator] AI response did not contain valid JSON:', response.content);
        return {
          intent: AssistantIntent.GeneralChat,
          confidence: 0.3,
          params: {},
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        intent: this.mapIntent(parsed.intent),
        confidence: parsed.confidence || 0.5,
        params: parsed.params || {},
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to detect intent:', error);
      return {
        intent: AssistantIntent.GeneralChat,
        confidence: 0.3,
        params: {},
      };
    }
  }

  /**
   * Map string intent to enum.
   */
  private mapIntent(intentStr: string): AssistantIntent {
    const mapping: Record<string, AssistantIntent> = {
      CreateTask: AssistantIntent.CreateTask,
      UpdateTask: AssistantIntent.UpdateTask,
      QueryTasks: AssistantIntent.QueryTasks,
      ScheduleEvent: AssistantIntent.ScheduleEvent,
      CaseQuery: AssistantIntent.CaseQuery,
      CaseSummary: AssistantIntent.CaseSummary,
      SearchEmails: AssistantIntent.SearchEmails,
      SummarizeThread: AssistantIntent.SummarizeThread,
      DraftEmail: AssistantIntent.DraftEmail,
      FindDocument: AssistantIntent.FindDocument,
      SummarizeDocument: AssistantIntent.SummarizeDocument,
      GenerateDocument: AssistantIntent.GenerateDocument,
      MorningBriefing: AssistantIntent.MorningBriefing,
      DeadlineAlert: AssistantIntent.DeadlineAlert,
      AskClarification: AssistantIntent.AskClarification,
      GeneralChat: AssistantIntent.GeneralChat,
    };

    return mapping[intentStr] || AssistantIntent.GeneralChat;
  }

  /**
   * Route to the appropriate intent handler.
   * Uses dedicated handlers for sophisticated NL processing.
   */
  private async routeIntent(
    intent: AssistantIntent,
    params: Record<string, unknown>,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const { userId, firmId } = userContext;
    const rawMessage = params.rawMessage as string | undefined;

    // Convert to handler-compatible context and user context
    const handlerContext = {
      currentScreen: context.currentScreen,
      currentCaseId: context.currentCaseId,
      currentDocumentId: context.currentDocumentId,
      selectedEmailId: context.selectedEmailId,
      selectedText: context.selectedText,
    };
    const handlerUserContext = {
      userId,
      firmId,
      role: userContext.role,
      email: userContext.email,
    };

    switch (intent) {
      case AssistantIntent.CreateTask: {
        // Use dedicated handler with raw message for NL processing
        const result = await taskIntentHandler.handleCreateTask(
          {
            rawText: rawMessage,
            title: params.taskTitle as string | undefined,
            dueDate: params.dueDate as string | undefined,
            priority: params.priority as string | undefined,
            caseId: params.caseId as string | undefined,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.QueryTasks: {
        const result = await taskIntentHandler.handleQueryTasks(
          {
            timeRange: (params.timeRange as 'today' | 'week' | 'month' | 'all') || 'week',
            status: params.status as 'pending' | 'completed' | 'overdue' | undefined,
          },
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.ScheduleEvent: {
        const result = await taskIntentHandler.handleScheduleEvent(
          {
            eventTitle: params.eventTitle as string | undefined,
            eventDate: params.eventDate as string | undefined,
            eventTime: params.eventTime as string | undefined,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.CaseQuery:
      case AssistantIntent.CaseSummary: {
        const result = await caseQueryHandler.handle(
          {
            caseId: (params.caseId as string) || context.currentCaseId,
            queryType: intent === AssistantIntent.CaseSummary ? 'summary' : 'general',
            question: rawMessage,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.SearchEmails: {
        const result = await emailIntentHandler.handleSearchEmails(
          {
            query: (params.searchQuery as string) || rawMessage || '',
            sender: params.sender as string | undefined,
            timeRange: params.timeRange as 'today' | 'week' | 'month' | 'all' | undefined,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.DraftEmail: {
        const result = await emailIntentHandler.handleDraftEmail(
          {
            replyToEmailId: (params.emailId as string) || context.selectedEmailId,
            tone: params.tone as 'formal' | 'professional' | 'brief' | undefined,
            recipientType: params.recipientType as
              | 'Client'
              | 'Court'
              | 'OpposingCounsel'
              | 'ThirdParty'
              | undefined,
            instructions: rawMessage,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.SummarizeThread: {
        const result = await emailIntentHandler.handleSummarizeThread(
          {
            emailId: (params.emailId as string) || context.selectedEmailId,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.FindDocument: {
        const result = await documentIntentHandler.handleFindDocument(
          {
            query: (params.searchQuery as string) || rawMessage || '',
            documentType: params.documentType as string | undefined,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.SummarizeDocument: {
        const result = await documentIntentHandler.handleSummarizeDocument(
          {
            documentId: (params.documentId as string) || context.currentDocumentId,
          },
          handlerContext,
          handlerUserContext
        );
        return this.convertHandlerResult(result);
      }

      case AssistantIntent.GenerateDocument:
        return this.handleGenerateDocument(params, context, userContext);

      case AssistantIntent.MorningBriefing:
        return this.handleMorningBriefing(userContext);

      case AssistantIntent.DeadlineAlert:
        return this.handleDeadlineAlert(userId, firmId);

      case AssistantIntent.GeneralChat:
      default:
        return this.handleGeneralChat(params);
    }
  }

  /**
   * Convert handler result to orchestrator format.
   * Ensures type compatibility between handler and orchestrator types.
   */
  private convertHandlerResult(result: {
    success: boolean;
    message?: string;
    data?: unknown;
    proposedAction?: {
      type: string;
      displayText: string;
      payload: Record<string, unknown>;
      requiresConfirmation?: boolean;
      confirmationPrompt?: string;
      entityPreview?: Record<string, unknown>;
    };
  }): HandlerResult {
    let proposedAction: ProposedAction | undefined;

    if (result.proposedAction) {
      proposedAction = {
        type: result.proposedAction.type,
        displayText: result.proposedAction.displayText,
        payload: result.proposedAction.payload,
        requiresConfirmation: result.proposedAction.requiresConfirmation ?? true,
        confirmationPrompt: result.proposedAction.confirmationPrompt,
        entityPreview: result.proposedAction.entityPreview,
      };
    }

    return {
      result: {
        success: result.success,
        message: result.message,
        data: result.data,
      },
      proposedAction,
    };
  }

  /**
   * Generate natural language response.
   * Uses Claude Sonnet for quality responses.
   */
  private async generateResponse(
    intent: AssistantIntent,
    result: unknown,
    context: AssistantContext,
    _language: 'ro' | 'en'
  ): Promise<string> {
    // For simple results, use template responses
    const simpleResponse = this.getTemplateResponse(intent, result);
    if (simpleResponse) {
      return simpleResponse;
    }

    // For complex results, use AI generation
    try {
      const prompt = RESPONSE_GENERATION_PROMPT.replace('{intent}', intent)
        .replace('{result}', JSON.stringify(result))
        .replace('{context}', JSON.stringify(context));

      const response = await aiService.generate({
        prompt,
        operationType: AIOperationType.Chat,
        modelOverride: this.selectModel(intent),
        firmId: 'system',
        maxTokens: 500,
        temperature: 0.7,
      });

      return response.content.trim();
    } catch (error) {
      console.error('[Orchestrator] Failed to generate response:', error);
      return 'Am procesat cererea dvs. cu succes.';
    }
  }

  /**
   * Get template response for simple results.
   */
  private getTemplateResponse(intent: AssistantIntent, result: unknown): string | null {
    const r = result as Record<string, unknown>;

    switch (intent) {
      case AssistantIntent.CreateTask:
        if (r.success && r.task) {
          const task = r.task as { title: string };
          return `Am creat sarcina "${task.title}". Doriți să o vedeți sau să adăugați detalii?`;
        }
        if (r.proposed) {
          return `Propun crearea sarcinii. Confirmați?`;
        }
        break;

      case AssistantIntent.QueryTasks:
        if (Array.isArray(r.tasks)) {
          const count = r.tasks.length;
          if (count === 0) {
            return 'Nu am găsit sarcini care să corespundă criteriilor.';
          }
          return `Am găsit ${count} sarcin${count === 1 ? 'ă' : 'i'}.`;
        }
        break;

      case AssistantIntent.MorningBriefing:
        if (r.briefing) {
          return null; // Let AI generate a nice briefing response
        }
        break;

      case AssistantIntent.GeneralChat:
        return null; // Let AI handle general chat
    }

    return null;
  }

  /**
   * Select model based on task complexity.
   */
  private selectModel(intent: AssistantIntent): ClaudeModel {
    // Haiku for fast, simple operations
    const haikuIntents = [
      AssistantIntent.CreateTask,
      AssistantIntent.UpdateTask,
      AssistantIntent.QueryTasks,
      AssistantIntent.ScheduleEvent,
      AssistantIntent.SearchEmails,
      AssistantIntent.FindDocument,
      AssistantIntent.DeadlineAlert,
    ];

    // Sonnet for quality responses
    const sonnetIntents = [
      AssistantIntent.CaseQuery,
      AssistantIntent.CaseSummary,
      AssistantIntent.SummarizeThread,
      AssistantIntent.DraftEmail,
      AssistantIntent.GenerateDocument,
      AssistantIntent.MorningBriefing,
      AssistantIntent.GeneralChat,
    ];

    if (haikuIntents.includes(intent)) {
      return ClaudeModel.Haiku;
    }

    if (sonnetIntents.includes(intent)) {
      return ClaudeModel.Sonnet;
    }

    return ClaudeModel.Sonnet; // Default to Sonnet
  }

  /**
   * Get suggested follow-up questions.
   */
  private getSuggestedFollowUps(intent: AssistantIntent, _result: unknown): string[] {
    const followUps: Record<AssistantIntent, string[]> = {
      [AssistantIntent.CreateTask]: [
        'Setează un termen limită',
        'Adaugă o prioritate',
        'Atribuie altcuiva',
      ],
      [AssistantIntent.UpdateTask]: ['Vezi toate sarcinile', 'Marchează ca finalizat'],
      [AssistantIntent.QueryTasks]: ['Creează o sarcină nouă', 'Filtrează după prioritate'],
      [AssistantIntent.ScheduleEvent]: ['Adaugă participanți', 'Setează reminder'],
      [AssistantIntent.CaseQuery]: ['Vezi rezumatul complet', 'Află sarcinile deschise'],
      [AssistantIntent.CaseSummary]: ['Vezi emailurile recente', 'Află termenele'],
      [AssistantIntent.SearchEmails]: ['Caută în alt dosar', 'Generează răspuns'],
      [AssistantIntent.SummarizeThread]: ['Redactează răspuns', 'Marchează ca citit'],
      [AssistantIntent.DraftEmail]: ['Modifică tonul', 'Adaugă atașament'],
      [AssistantIntent.FindDocument]: ['Deschide documentul', 'Caută alt document'],
      [AssistantIntent.SummarizeDocument]: ['Extrage punctele cheie', 'Compară cu alt document'],
      [AssistantIntent.GenerateDocument]: ['Editează documentul', 'Exportă PDF'],
      [AssistantIntent.MorningBriefing]: ['Vezi sarcinile urgente', 'Deschide calendarul'],
      [AssistantIntent.DeadlineAlert]: ['Creează reminder', 'Vezi toate termenele'],
      [AssistantIntent.AskClarification]: [],
      [AssistantIntent.GeneralChat]: ['Ajutor', 'Ce poți face?'],
    };

    return followUps[intent] || [];
  }

  /**
   * Get clarification suggestions when confidence is low.
   */
  private getClarificationSuggestions(intent: AssistantIntent): string[] {
    const suggestions: Record<AssistantIntent, string[]> = {
      [AssistantIntent.CreateTask]: ['Vreau să creez o sarcină', 'Adaugă un task'],
      [AssistantIntent.QueryTasks]: ['Arată-mi sarcinile mele', 'Ce am de făcut?'],
      [AssistantIntent.CaseQuery]: ['Spune-mi despre dosar', 'Care e statusul dosarului?'],
      [AssistantIntent.SearchEmails]: ['Găsește un email', 'Caută în emailuri'],
      [AssistantIntent.GeneralChat]: ['Ajutor', 'Ce poți face?'],
      [AssistantIntent.UpdateTask]: ['Modifică sarcina', 'Actualizează task-ul'],
      [AssistantIntent.ScheduleEvent]: ['Programează întâlnire', 'Adaugă eveniment'],
      [AssistantIntent.CaseSummary]: ['Rezumatul dosarului', 'Ce s-a întâmplat în dosar?'],
      [AssistantIntent.SummarizeThread]: ['Rezumă conversația', 'Ce zice în emailuri?'],
      [AssistantIntent.DraftEmail]: ['Scrie un email', 'Redactează răspuns'],
      [AssistantIntent.FindDocument]: ['Găsește document', 'Unde e contractul?'],
      [AssistantIntent.SummarizeDocument]: ['Rezumă documentul', 'Ce zice în document?'],
      [AssistantIntent.GenerateDocument]: ['Generează contract', 'Creează document'],
      [AssistantIntent.MorningBriefing]: ['Briefing zilnic', 'Ce am pe azi?'],
      [AssistantIntent.DeadlineAlert]: ['Termene apropiate', 'Ce deadline-uri am?'],
      [AssistantIntent.AskClarification]: [],
    };

    return suggestions[intent] || ['Ajutor', 'Ce poți face?'];
  }

  // ============================================================================
  // Intent Handlers
  // ============================================================================

  /**
   * Handle CreateTask intent.
   */
  private async handleCreateTask(
    params: Record<string, unknown>,
    context: AssistantContext,
    userId: string,
    _firmId: string
  ): Promise<HandlerResult> {
    const taskTitle = (params.taskTitle as string) || 'Sarcină nouă';
    const caseId = (params.caseId as string) || context.currentCaseId;
    const priority = params.priority as string | undefined;
    const dueDate = params.dueDate as string | undefined;

    // Build proposed action for confirmation
    const proposedAction: ProposedAction = {
      type: 'CREATE_TASK',
      displayText: `Creează sarcina: "${taskTitle}"`,
      payload: {
        title: taskTitle,
        caseId,
        priority: priority || 'Medium',
        dueDate,
        assignedTo: userId,
      },
      requiresConfirmation: true,
      confirmationPrompt: `Doriți să creez sarcina "${taskTitle}"?`,
      entityPreview: {
        title: taskTitle,
        case: caseId ? 'Dosar curent' : 'Fără dosar',
        priority: priority || 'Medium',
        dueDate: dueDate || 'Fără termen',
      },
    };

    return {
      result: { proposed: true, taskTitle, caseId },
      proposedAction,
    };
  }

  /**
   * Handle QueryTasks intent.
   */
  private async handleQueryTasks(
    params: Record<string, unknown>,
    userId: string,
    firmId: string
  ): Promise<HandlerResult> {
    try {
      const statusFilter = params.status ? [params.status as TaskStatus] : undefined;
      const priorityFilter = params.priority ? [params.priority as TaskPriority] : undefined;

      const tasks = await this.taskService.getTasksByAssignee(userId, firmId, {
        statuses: statusFilter,
        priorities: priorityFilter,
      });

      return {
        result: { tasks, count: tasks.length },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to query tasks:', error);
      return {
        result: { tasks: [], count: 0, error: 'Nu am putut încărca sarcinile' },
      };
    }
  }

  /**
   * Handle CaseQuery/CaseSummary intent.
   */
  private async handleCaseQuery(
    params: Record<string, unknown>,
    context: AssistantContext,
    firmId: string
  ): Promise<HandlerResult> {
    const caseId = (params.caseId as string) || context.currentCaseId;

    if (!caseId) {
      return {
        result: { error: 'Nu am identificat un dosar. Specificați dosarul.' },
      };
    }

    try {
      // Get case summary
      const summary = await caseSummaryService.getCaseSummary(caseId);

      if (!summary) {
        // Generate summary if not exists
        await caseSummaryService.generateSummary(caseId, firmId);
        const newSummary = await caseSummaryService.getCaseSummary(caseId);
        return {
          result: { summary: newSummary, generated: true },
        };
      }

      return {
        result: { summary, generated: false },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to get case summary:', error);
      return {
        result: { error: 'Nu am putut obține informații despre dosar' },
      };
    }
  }

  /**
   * Handle SearchEmails intent.
   */
  private async handleSearchEmails(
    params: Record<string, unknown>,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const query = (params.searchQuery as string) || '';

    if (!query) {
      return {
        result: { error: 'Specificați ce căutați în emailuri.' },
      };
    }

    try {
      // Search emails directly in the database since searchService is for cases/documents
      const emails = await prisma.email.findMany({
        where: {
          userId: userContext.userId,
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { bodyPreview: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { receivedDateTime: 'desc' },
        take: 10,
        select: {
          id: true,
          subject: true,
          bodyPreview: true,
          from: true,
          receivedDateTime: true,
        },
      });

      return {
        result: { emails, count: emails.length },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to search emails:', error);
      return {
        result: { emails: [], count: 0, error: 'Eroare la căutarea emailurilor' },
      };
    }
  }

  /**
   * Handle DraftEmail intent.
   */
  private async handleDraftEmail(
    params: Record<string, unknown>,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const emailId = (params.emailId as string) || context.selectedEmailId;

    if (!emailId) {
      return {
        result: { error: 'Selectați un email pentru a redacta răspunsul.' },
        proposedAction: {
          type: 'SELECT_EMAIL',
          displayText: 'Selectați un email',
          payload: {},
          requiresConfirmation: false,
        },
      };
    }

    try {
      const draft = await emailDraftingService.generateDraft(
        {
          emailId,
          tone: (params.tone as 'Formal' | 'Professional' | 'Brief' | 'Detailed') || 'Professional',
          recipientType:
            (params.recipientType as
              | 'Client'
              | 'Court'
              | 'OpposingCounsel'
              | 'ThirdParty'
              | 'Internal') || 'Client',
          instructions: params.instructions as string | undefined,
        },
        userContext
      );

      return {
        result: { draft, success: true },
        proposedAction: {
          type: 'SEND_EMAIL',
          displayText: 'Trimite emailul',
          payload: { draftId: draft.id },
          requiresConfirmation: true,
          confirmationPrompt: 'Doriți să trimiteți acest email?',
          entityPreview: {
            subject: draft.subject,
            bodyPreview: draft.body.substring(0, 200),
          },
        },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to generate draft:', error);
      return {
        result: { error: 'Nu am putut genera draft-ul emailului' },
      };
    }
  }

  /**
   * Handle FindDocument intent.
   */
  private async handleFindDocument(
    params: Record<string, unknown>,
    _context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const query = (params.searchQuery as string) || '';

    if (!query) {
      return {
        result: { error: 'Specificați ce document căutați.' },
      };
    }

    try {
      // Use the search service with correct signature
      const results = await searchService.search(
        query,
        userContext.firmId,
        SearchMode.HYBRID,
        {}, // No filters for now
        10, // limit
        0 // offset
      );

      // Filter for documents only
      const documents = results.results.filter((r) => r.type === 'document');

      return {
        result: { documents, count: documents.length },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to search documents:', error);
      return {
        result: { documents: [], count: 0, error: 'Eroare la căutarea documentelor' },
      };
    }
  }

  /**
   * Handle GenerateDocument intent.
   */
  private async handleGenerateDocument(
    params: Record<string, unknown>,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const documentType = params.documentType as string | undefined;

    if (!documentType) {
      return {
        result: { error: 'Specificați tipul de document (contract, cerere, etc.).' },
        proposedAction: {
          type: 'SELECT_DOCUMENT_TYPE',
          displayText: 'Alegeți tipul de document',
          payload: {
            options: ['Contract', 'Motion', 'Letter', 'Memo', 'Pleading'],
          },
          requiresConfirmation: false,
        },
      };
    }

    try {
      const document = await documentGenerationService.generateDocument(
        {
          type: documentType as 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading',
          caseId: context.currentCaseId,
          instructions:
            (params.instructions as string) || `Generează un document de tip ${documentType}`,
        },
        userContext
      );

      return {
        result: { document, success: true },
        proposedAction: {
          type: 'SAVE_DOCUMENT',
          displayText: 'Salvează documentul',
          payload: { document },
          requiresConfirmation: true,
          confirmationPrompt: 'Doriți să salvați acest document?',
          entityPreview: {
            title: document.title,
            format: document.format,
            suggestedFileName: document.suggestedFileName,
          },
        },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to generate document:', error);
      return {
        result: { error: 'Nu am putut genera documentul' },
      };
    }
  }

  /**
   * Handle MorningBriefing intent.
   */
  private async handleMorningBriefing(userContext: UserContext): Promise<HandlerResult> {
    try {
      const briefing = await morningBriefingService.generateBriefing(userContext);

      return {
        result: { briefing, success: true },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to generate morning briefing:', error);
      return {
        result: { error: 'Nu am putut genera briefing-ul zilnic' },
      };
    }
  }

  /**
   * Handle DeadlineAlert intent.
   */
  private async handleDeadlineAlert(userId: string, firmId: string): Promise<HandlerResult> {
    try {
      // Get upcoming deadlines (tasks with due dates in the next 7 days)
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const tasks = await prisma.task.findMany({
        where: {
          assignedTo: userId,
          firmId,
          dueDate: {
            gte: now,
            lte: nextWeek,
          },
          status: { not: 'Completed' },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
          case: { select: { title: true, caseNumber: true } },
        },
      });

      return {
        result: {
          deadlines: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            case: t.case ? { title: t.case.title, caseNumber: t.case.caseNumber } : null,
          })),
          count: tasks.length,
        },
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to get deadlines:', error);
      return {
        result: { deadlines: [], count: 0, error: 'Nu am putut încărca termenele' },
      };
    }
  }

  /**
   * Handle GeneralChat intent.
   */
  private handleGeneralChat(params: Record<string, unknown>): HandlerResult {
    return {
      result: {
        type: 'general_chat',
        message: params.message || 'Conversație generală',
      },
    };
  }
}

// Export singleton instance
export const aiOrchestratorService = new AIOrchestratorService();
