/**
 * Natural Language Command Service
 * Story 1.5: QuickActionsBar AI Processing
 *
 * Processes natural language input in Romanian and executes appropriate actions
 * using AI for intent detection and parameter extraction.
 */

import { prisma } from '@legal-platform/database';
import { TaskTypeEnum, TaskPriority } from '@prisma/client';
import { AIOperationType, TaskType, ClaudeModel } from '@legal-platform/types';
import { aiService } from './ai.service';
import { getModelForFeature } from './ai-client.service';
import { TaskService } from './task.service';
import { TimeEntryService } from './time-entry.service';

// ============================================================================
// Model Mapping
// ============================================================================

/**
 * Map model ID string to ClaudeModel enum value
 */
function modelIdToClaudeModel(modelId: string): ClaudeModel {
  const enumValues = Object.values(ClaudeModel) as string[];
  if (enumValues.includes(modelId)) return modelId as ClaudeModel;
  if (modelId.includes('haiku')) return ClaudeModel.Haiku;
  if (modelId.includes('opus')) return ClaudeModel.Opus;
  return ClaudeModel.Sonnet;
}

// ============================================================================
// Types
// ============================================================================

export enum CommandIntent {
  CREATE_TASK = 'CREATE_TASK',
  ADD_DOCUMENT = 'ADD_DOCUMENT',
  SCHEDULE_DEADLINE = 'SCHEDULE_DEADLINE',
  EMAIL_CLIENT = 'EMAIL_CLIENT',
  LOG_TIME = 'LOG_TIME',
  UNKNOWN = 'UNKNOWN',
}

export enum CommandStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  CLARIFICATION_NEEDED = 'CLARIFICATION_NEEDED',
}

export interface CommandParams {
  title?: string;
  description?: string;
  dueDate?: Date;
  dueTime?: string;
  priority?: TaskPriority;
  taskType?: TaskTypeEnum;
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
  caseId: string;
  preselectedIntent?: CommandIntent;
}

export interface UserContext {
  userId: string;
  firmId: string;
}

// ============================================================================
// AI Prompt Templates
// ============================================================================

const INTENT_DETECTION_SYSTEM_PROMPT = `You are a legal assistant AI that processes natural language commands in Romanian for a law firm case management system.

IMPORTANT: Răspunde în limba română. Toate explicațiile (reasoning) trebuie să fie în română.

Your task is to analyze user input and extract:
1. Intent - what action the user wants to perform
2. Parameters - specific details from the command

Available intents:
- CREATE_TASK: User wants to create a task (keywords: "creează sarcină", "adaugă task", "sarcină nouă", "creează", "sarcină")
- ADD_DOCUMENT: User wants to add/upload a document (keywords: "adaugă document", "încarcă fișier", "document nou")
- SCHEDULE_DEADLINE: User wants to schedule a deadline/hearing (keywords: "programează termen", "setează deadline", "termen", "deadline")
- EMAIL_CLIENT: User wants to send email to client (keywords: "trimite email", "contactează client", "email", "mesaj")
- LOG_TIME: User wants to log time (keywords: "înregistrează timp", "log timp", "ore lucrate", "timp")
- UNKNOWN: Cannot determine intent

For task priority, detect:
- Urgent: "urgent", "urgență", "imediat", "acum"
- High: "important", "prioritar", "înalt"
- Medium: default if not specified
- Low: "când poți", "neurgent", "prioritate scăzută"

For task type, detect:
- Research: "cercetare", "research", "analiză", "studiază"
- DocumentCreation: "redactare", "creare document", "scrie"
- DocumentRetrieval: "găsește document", "caută document"
- CourtDate: "ședință", "instanță", "tribunal"
- Meeting: "întâlnire", "meeting", "conferință"
- BusinessTrip: "deplasare", "călătorie"

For dates, interpret Romanian date expressions:
- "azi", "astăzi" = today
- "mâine" = tomorrow
- "poimâine" = day after tomorrow
- "săptămâna viitoare" = next week
- "vineri" = this/next Friday
- "luni", "marți", etc. = day of week

Respond in JSON format only:
{
  "intent": "CREATE_TASK|ADD_DOCUMENT|SCHEDULE_DEADLINE|EMAIL_CLIENT|LOG_TIME|UNKNOWN",
  "confidence": 0.0-1.0,
  "params": {
    "title": "extracted title or null",
    "description": "extracted description or null",
    "dueDate": "YYYY-MM-DD or null",
    "dueTime": "HH:MM or null",
    "priority": "Urgent|High|Medium|Low or null",
    "taskType": "Research|DocumentCreation|DocumentRetrieval|CourtDate|Meeting|BusinessTrip or null",
    "durationMinutes": number or null,
    "recipientEmail": "email or null",
    "documentType": "document type or null"
  },
  "reasoning": "brief explanation of interpretation"
}`;

// ============================================================================
// Service
// ============================================================================

export class NaturalLanguageCommandService {
  private taskService: TaskService;
  private timeEntryService: TimeEntryService;

  constructor() {
    this.taskService = new TaskService();
    this.timeEntryService = new TimeEntryService();
  }

  /**
   * Process a natural language command and execute the appropriate action
   */
  async processCommand(
    input: ProcessCommandInput,
    userContext: UserContext
  ): Promise<NaturalLanguageCommandResult> {
    const { input: commandText, caseId, preselectedIntent } = input;
    const { userId, firmId } = userContext;

    // Validate case access
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { id: true, title: true, clientId: true },
    });

    if (!caseRecord) {
      return {
        success: false,
        status: CommandStatus.FAILED,
        intent: CommandIntent.UNKNOWN,
        confidence: 0,
        message: 'Dosarul nu a fost găsit sau nu aveți acces.',
      };
    }

    // If preselected intent, use it directly for quick actions
    if (preselectedIntent && preselectedIntent !== CommandIntent.UNKNOWN) {
      return this.handlePreselectedIntent(preselectedIntent, commandText, caseId, userId, firmId);
    }

    // Use AI to detect intent and extract parameters
    const aiResult = await this.detectIntentWithAI(commandText, firmId);

    if (!aiResult) {
      return {
        success: false,
        status: CommandStatus.FAILED,
        intent: CommandIntent.UNKNOWN,
        confidence: 0,
        message: 'Nu am putut procesa comanda. Vă rugăm să încercați din nou.',
      };
    }

    const { intent, confidence, params } = aiResult;

    // Low confidence - ask for clarification
    if (confidence < 0.5) {
      return {
        success: false,
        status: CommandStatus.CLARIFICATION_NEEDED,
        intent: intent,
        confidence,
        message: 'Nu am înțeles exact ce doriți. Puteți reformula comanda?',
        extractedParams: params,
        suggestedActions: this.getSuggestedActions(intent),
      };
    }

    // Execute the command based on intent
    return this.executeCommand(intent, params, caseId, userId, firmId, confidence);
  }

  /**
   * Use AI to detect intent and extract parameters from Romanian text
   */
  private async detectIntentWithAI(
    commandText: string,
    firmId: string
  ): Promise<{ intent: CommandIntent; confidence: number; params: CommandParams } | null> {
    try {
      // Get configured model (natural language uses same as email classification)
      const modelId = await getModelForFeature(firmId, 'email_classification');
      const modelOverride = modelIdToClaudeModel(modelId);

      const response = await aiService.generate({
        prompt: `Analyze this Romanian command: "${commandText}"`,
        systemPrompt: INTENT_DETECTION_SYSTEM_PROMPT,
        operationType: AIOperationType.TaskParsing,
        firmId,
        modelOverride,
        maxTokens: 500,
        temperature: 0.1, // Low temperature for consistent parsing
      });

      // Parse AI response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('AI response did not contain valid JSON:', response.content);
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Map the parsed result
      const intent = this.mapIntent(parsed.intent);
      const params = this.mapParams(parsed.params);

      return {
        intent,
        confidence: parsed.confidence || 0.5,
        params,
      };
    } catch (error) {
      console.error('Failed to detect intent with AI:', error);
      return null;
    }
  }

  /**
   * Map string intent to enum
   */
  private mapIntent(intentStr: string): CommandIntent {
    const mapping: Record<string, CommandIntent> = {
      CREATE_TASK: CommandIntent.CREATE_TASK,
      ADD_DOCUMENT: CommandIntent.ADD_DOCUMENT,
      SCHEDULE_DEADLINE: CommandIntent.SCHEDULE_DEADLINE,
      EMAIL_CLIENT: CommandIntent.EMAIL_CLIENT,
      LOG_TIME: CommandIntent.LOG_TIME,
    };
    return mapping[intentStr] || CommandIntent.UNKNOWN;
  }

  /**
   * Map and validate extracted parameters
   */
  private mapParams(rawParams: Record<string, unknown>): CommandParams {
    const params: CommandParams = {};

    if (rawParams.title && typeof rawParams.title === 'string') {
      params.title = rawParams.title;
    }

    if (rawParams.description && typeof rawParams.description === 'string') {
      params.description = rawParams.description;
    }

    if (rawParams.dueDate && typeof rawParams.dueDate === 'string') {
      const date = new Date(rawParams.dueDate);
      if (!isNaN(date.getTime())) {
        params.dueDate = date;
      }
    }

    if (rawParams.dueTime && typeof rawParams.dueTime === 'string') {
      params.dueTime = rawParams.dueTime;
    }

    if (rawParams.priority && typeof rawParams.priority === 'string') {
      const priorityMap: Record<string, TaskPriority> = {
        Urgent: TaskPriority.Urgent,
        High: TaskPriority.High,
        Medium: TaskPriority.Medium,
        Low: TaskPriority.Low,
      };
      params.priority = priorityMap[rawParams.priority] || TaskPriority.Medium;
    }

    if (rawParams.taskType && typeof rawParams.taskType === 'string') {
      const typeMap: Record<string, TaskTypeEnum> = {
        Research: TaskTypeEnum.Research,
        DocumentCreation: TaskTypeEnum.DocumentCreation,
        DocumentRetrieval: TaskTypeEnum.DocumentRetrieval,
        CourtDate: TaskTypeEnum.CourtDate,
        Meeting: TaskTypeEnum.Meeting,
        BusinessTrip: TaskTypeEnum.BusinessTrip,
      };
      params.taskType = typeMap[rawParams.taskType];
    }

    if (rawParams.durationMinutes && typeof rawParams.durationMinutes === 'number') {
      params.durationMinutes = rawParams.durationMinutes;
    }

    if (rawParams.recipientEmail && typeof rawParams.recipientEmail === 'string') {
      params.recipientEmail = rawParams.recipientEmail;
    }

    if (rawParams.documentType && typeof rawParams.documentType === 'string') {
      params.documentType = rawParams.documentType;
    }

    return params;
  }

  /**
   * Execute the command based on detected intent
   */
  private async executeCommand(
    intent: CommandIntent,
    params: CommandParams,
    caseId: string,
    userId: string,
    firmId: string,
    confidence: number
  ): Promise<NaturalLanguageCommandResult> {
    switch (intent) {
      case CommandIntent.CREATE_TASK:
        return this.createTask(params, caseId, userId, confidence);

      case CommandIntent.LOG_TIME:
        return this.logTime(params, caseId, userId, confidence);

      case CommandIntent.ADD_DOCUMENT:
        return this.prepareAddDocument(params, caseId, confidence);

      case CommandIntent.SCHEDULE_DEADLINE:
        return this.scheduleDeadline(params, caseId, userId, confidence);

      case CommandIntent.EMAIL_CLIENT:
        return this.prepareEmailClient(params, caseId, confidence);

      default:
        return {
          success: false,
          status: CommandStatus.FAILED,
          intent: CommandIntent.UNKNOWN,
          confidence,
          message: 'Nu am înțeles comanda. Încercați una dintre sugestiile de mai jos.',
          suggestedActions: this.getAllSuggestedActions(),
        };
    }
  }

  /**
   * Create a task from natural language command
   */
  private async createTask(
    params: CommandParams,
    caseId: string,
    userId: string,
    confidence: number
  ): Promise<NaturalLanguageCommandResult> {
    try {
      // Set defaults
      const title = params.title || 'Sarcină nouă';
      const dueDate = params.dueDate || this.getDefaultDueDate();
      const taskTypeEnum = params.taskType || TaskTypeEnum.Research;
      // Convert TaskTypeEnum to TaskType string - only pass types supported by TaskType
      const validTaskTypes: TaskType[] = [
        'Research',
        'DocumentCreation',
        'DocumentRetrieval',
        'CourtDate',
        'Meeting',
        'BusinessTrip',
      ];
      const taskType: TaskType = validTaskTypes.includes(taskTypeEnum as TaskType)
        ? (taskTypeEnum as TaskType)
        : 'Research';
      const priority = params.priority || TaskPriority.Medium;

      const task = await this.taskService.createTask(
        {
          caseId,
          title,
          description: params.description || undefined,
          assignedTo: userId, // Assign to self by default
          dueDate,
          dueTime: params.dueTime || undefined,
          type: taskType,
          priority,
        },
        userId
      );

      return {
        success: true,
        status: CommandStatus.SUCCESS,
        intent: CommandIntent.CREATE_TASK,
        confidence,
        message: `Sarcină creată: "${task.title}"`,
        entityId: task.id,
        entityType: 'Task',
        extractedParams: params,
        suggestedActions: [
          {
            type: 'VIEW_TASK',
            label: 'Vezi sarcina',
            params: { taskId: task.id },
          },
          {
            type: 'EDIT_TASK',
            label: 'Editează detalii',
            params: { taskId: task.id },
          },
        ],
      };
    } catch (error) {
      console.error('Failed to create task:', error);
      return {
        success: false,
        status: CommandStatus.FAILED,
        intent: CommandIntent.CREATE_TASK,
        confidence,
        message: `Nu am putut crea sarcina: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
        extractedParams: params,
      };
    }
  }

  /**
   * Log time from natural language command
   */
  private async logTime(
    params: CommandParams,
    caseId: string,
    userId: string,
    confidence: number
  ): Promise<NaturalLanguageCommandResult> {
    try {
      const hours = params.durationMinutes ? params.durationMinutes / 60 : 1;
      const description = params.description || params.title || 'Timp înregistrat';

      const timeEntry = await this.timeEntryService.createTimeEntry(
        {
          caseId,
          date: new Date().toISOString(),
          hours,
          description,
          billable: true,
        },
        userId
      );

      return {
        success: true,
        status: CommandStatus.SUCCESS,
        intent: CommandIntent.LOG_TIME,
        confidence,
        message: `Timp înregistrat: ${hours} ore - "${description}"`,
        entityId: timeEntry.id,
        entityType: 'TimeEntry',
        extractedParams: params,
      };
    } catch (error) {
      console.error('Failed to log time:', error);
      return {
        success: false,
        status: CommandStatus.FAILED,
        intent: CommandIntent.LOG_TIME,
        confidence,
        message: `Nu am putut înregistra timpul: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
        extractedParams: params,
      };
    }
  }

  /**
   * Prepare to add document (returns suggestion to open upload dialog)
   */
  private prepareAddDocument(
    params: CommandParams,
    caseId: string,
    confidence: number
  ): NaturalLanguageCommandResult {
    return {
      success: true,
      status: CommandStatus.PARTIAL,
      intent: CommandIntent.ADD_DOCUMENT,
      confidence,
      message: 'Deschideți dialogul pentru încărcare document.',
      extractedParams: params,
      suggestedActions: [
        {
          type: 'OPEN_UPLOAD_DIALOG',
          label: 'Încarcă document',
          params: { caseId, documentType: params.documentType },
        },
      ],
    };
  }

  /**
   * Schedule a deadline (creates a CourtDate task)
   */
  private async scheduleDeadline(
    params: CommandParams,
    caseId: string,
    userId: string,
    confidence: number
  ): Promise<NaturalLanguageCommandResult> {
    try {
      const title = params.title || 'Termen nou';
      const dueDate = params.dueDate || this.getDefaultDueDate();

      const task = await this.taskService.createTask(
        {
          caseId,
          title,
          description: params.description || 'Termen programat prin comandă vocală',
          assignedTo: userId,
          dueDate,
          dueTime: params.dueTime || undefined,
          type: TaskTypeEnum.CourtDate,
          priority: params.priority || TaskPriority.High,
        },
        userId
      );

      return {
        success: true,
        status: CommandStatus.SUCCESS,
        intent: CommandIntent.SCHEDULE_DEADLINE,
        confidence,
        message: `Termen programat: "${task.title}" pentru ${this.formatDate(dueDate)}`,
        entityId: task.id,
        entityType: 'Task',
        extractedParams: params,
        suggestedActions: [
          {
            type: 'VIEW_TASK',
            label: 'Vezi termenul',
            params: { taskId: task.id },
          },
          {
            type: 'ADD_TO_CALENDAR',
            label: 'Adaugă în calendar',
            params: { taskId: task.id },
          },
        ],
      };
    } catch (error) {
      console.error('Failed to schedule deadline:', error);
      return {
        success: false,
        status: CommandStatus.FAILED,
        intent: CommandIntent.SCHEDULE_DEADLINE,
        confidence,
        message: `Nu am putut programa termenul: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
        extractedParams: params,
      };
    }
  }

  /**
   * Prepare to email client (returns suggestion to open email composer)
   */
  private prepareEmailClient(
    params: CommandParams,
    caseId: string,
    confidence: number
  ): NaturalLanguageCommandResult {
    return {
      success: true,
      status: CommandStatus.PARTIAL,
      intent: CommandIntent.EMAIL_CLIENT,
      confidence,
      message: 'Deschideți dialogul pentru trimitere email.',
      extractedParams: params,
      suggestedActions: [
        {
          type: 'OPEN_EMAIL_COMPOSER',
          label: 'Compune email',
          params: { caseId, recipientEmail: params.recipientEmail },
        },
      ],
    };
  }

  /**
   * Handle preselected intent from quick action chips
   */
  private handlePreselectedIntent(
    intent: CommandIntent,
    commandText: string,
    caseId: string,
    _userId: string,
    _firmId: string
  ): NaturalLanguageCommandResult {
    // For preselected intents, we return a partial result that opens the appropriate dialog
    const intentMessages: Record<CommandIntent, { message: string; action: SuggestedAction }> = {
      [CommandIntent.CREATE_TASK]: {
        message: 'Deschideți formularul pentru creare sarcină.',
        action: {
          type: 'OPEN_TASK_DIALOG',
          label: 'Creează sarcină',
          params: { caseId, prefill: commandText },
        },
      },
      [CommandIntent.ADD_DOCUMENT]: {
        message: 'Deschideți dialogul pentru încărcare document.',
        action: { type: 'OPEN_UPLOAD_DIALOG', label: 'Încarcă document', params: { caseId } },
      },
      [CommandIntent.SCHEDULE_DEADLINE]: {
        message: 'Deschideți formularul pentru programare termen.',
        action: {
          type: 'OPEN_DEADLINE_DIALOG',
          label: 'Programează termen',
          params: { caseId, prefill: commandText },
        },
      },
      [CommandIntent.EMAIL_CLIENT]: {
        message: 'Deschideți dialogul pentru trimitere email.',
        action: { type: 'OPEN_EMAIL_COMPOSER', label: 'Compune email', params: { caseId } },
      },
      [CommandIntent.LOG_TIME]: {
        message: 'Deschideți formularul pentru înregistrare timp.',
        action: { type: 'OPEN_TIME_DIALOG', label: 'Înregistrează timp', params: { caseId } },
      },
      [CommandIntent.UNKNOWN]: {
        message: 'Selectați o acțiune din sugestiile de mai jos.',
        action: { type: 'SHOW_HELP', label: 'Ajutor', params: {} },
      },
    };

    const config = intentMessages[intent] || intentMessages[CommandIntent.UNKNOWN];

    return {
      success: true,
      status: CommandStatus.PARTIAL,
      intent,
      confidence: 1.0,
      message: config.message,
      suggestedActions: [config.action],
    };
  }

  /**
   * Get suggested actions for a specific intent
   */
  private getSuggestedActions(intent: CommandIntent): SuggestedAction[] {
    switch (intent) {
      case CommandIntent.CREATE_TASK:
        return [
          { type: 'CREATE_TASK', label: 'Creează sarcină', params: {} },
          {
            type: 'CREATE_TASK_RESEARCH',
            label: 'Sarcină cercetare',
            params: { taskType: 'Research' },
          },
        ];
      case CommandIntent.ADD_DOCUMENT:
        return [{ type: 'OPEN_UPLOAD_DIALOG', label: 'Încarcă document', params: {} }];
      case CommandIntent.SCHEDULE_DEADLINE:
        return [{ type: 'OPEN_DEADLINE_DIALOG', label: 'Programează termen', params: {} }];
      case CommandIntent.EMAIL_CLIENT:
        return [{ type: 'OPEN_EMAIL_COMPOSER', label: 'Trimite email', params: {} }];
      case CommandIntent.LOG_TIME:
        return [{ type: 'OPEN_TIME_DIALOG', label: 'Înregistrează timp', params: {} }];
      default:
        return this.getAllSuggestedActions();
    }
  }

  /**
   * Get all available suggested actions
   */
  private getAllSuggestedActions(): SuggestedAction[] {
    return [
      { type: 'CREATE_TASK', label: 'Creează sarcină', params: {} },
      { type: 'OPEN_UPLOAD_DIALOG', label: 'Adaugă document', params: {} },
      { type: 'OPEN_DEADLINE_DIALOG', label: 'Programează termen', params: {} },
      { type: 'OPEN_EMAIL_COMPOSER', label: 'Email client', params: {} },
      { type: 'OPEN_TIME_DIALOG', label: 'Înregistrează timp', params: {} },
    ];
  }

  /**
   * Get default due date (tomorrow)
   */
  private getDefaultDueDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0); // 5 PM tomorrow
    return tomorrow;
  }

  /**
   * Format date for Romanian display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('ro-RO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

// Export singleton instance
export const naturalLanguageCommandService = new NaturalLanguageCommandService();
