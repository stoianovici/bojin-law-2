/**
 * Task Parser Service
 * Story 4.1: Natural Language Task Parser
 *
 * Parses natural language task input into structured task data
 * Supports Romanian and English input with confidence scoring
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AIOperationType,
  ClaudeModel,
  TaskType,
  NLPTaskParseRequest,
  NLPTaskParseResponse,
  TaskParseContext,
  ParsedTaskFields,
  ParsedEntity,
  ParsedEntityType,
  TaskPriority,
} from '@legal-platform/types';
import { providerManager, ProviderRequest } from './provider-manager.service';
import { modelRouter } from './model-router.service';
import { tokenTracker } from './token-tracker.service';

/**
 * System prompt for task parsing optimized for Romanian legal terminology
 */
const TASK_PARSING_SYSTEM_PROMPT = `You are a legal task parsing assistant for a Romanian law firm management system.
Your job is to extract structured task information from natural language input.

Extract these fields:
1. Task Type: One of: Research, DocumentCreation, DocumentRetrieval, CourtDate, Meeting, BusinessTrip
2. Title: Brief task title (max 100 chars)
3. Description: Additional details mentioned (if any)
4. Due Date: Parse relative/absolute dates (format: YYYY-MM-DD)
5. Due Time: If mentioned (24h format: HH:mm)
6. Priority: Low, Medium, High, Urgent (default: Medium if not specified)
7. Assignee: Name of person if mentioned
8. Case Reference: Case number or client name if mentioned

Rules:
- Detect language (Romanian or English) based on input text
- Handle Romanian legal terms: "ședință" (meeting/hearing), "termen" (deadline/hearing date), "dosar" (case file), "client", "întâlnire" (meeting)
- Parse Romanian date formats: "luni viitoare" (next Monday), "15 decembrie", "maine" (tomorrow), "saptamana viitoare" (next week), "poimaine" (day after tomorrow)
- Parse English date formats: "next Tuesday", "December 15", "tomorrow", "next week"
- If unsure about a field, set confidence < 0.5
- Return structured JSON response only

Task Type Mappings:
- "meeting", "întâlnire", "ședință" → Meeting
- "court", "instanță", "judecătorie", "termen" → CourtDate
- "research", "cercetare", "analiză" → Research
- "document", "redactare", "scrie", "draft" → DocumentCreation
- "get document", "retrieve", "caută document" → DocumentRetrieval
- "travel", "călătorie", "deplasare" → BusinessTrip

Priority Mappings:
- "urgent", "ASAP", "imediat", "azi" → Urgent
- "important", "high priority", "prioritar" → High
- "normal", "standard" → Medium
- "low", "when possible", "când ai timp" → Low

Respond ONLY with valid JSON in this exact format:
{
  "detectedLanguage": "ro" or "en",
  "parsedTask": {
    "taskType": { "value": "TaskType or null", "confidence": 0.0-1.0 },
    "title": { "value": "string or null", "confidence": 0.0-1.0 },
    "description": { "value": "string or null", "confidence": 0.0-1.0 },
    "dueDate": { "value": "YYYY-MM-DD or null", "confidence": 0.0-1.0 },
    "dueTime": { "value": "HH:mm or null", "confidence": 0.0-1.0 },
    "priority": { "value": "Priority or null", "confidence": 0.0-1.0 },
    "assigneeName": { "value": "string or null", "confidence": 0.0-1.0 },
    "caseReference": { "value": "string or null", "confidence": 0.0-1.0 }
  },
  "entities": [
    {
      "type": "entityType",
      "value": "original text",
      "normalizedValue": "parsed value",
      "startIndex": number,
      "endIndex": number,
      "confidence": 0.0-1.0
    }
  ],
  "overallConfidence": 0.0-1.0
}`;

/**
 * Parse AI response JSON safely
 */
function parseAIResponse(content: string): Record<string, unknown> | null {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI response as JSON:', content);
    return null;
  }
}

/**
 * Calculate the current date for relative date resolution
 */
function getCurrentDateForContext(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export class TaskParserService {
  /**
   * Parse natural language task input
   */
  async parseTaskInput(
    request: NLPTaskParseRequest,
    context?: TaskParseContext
  ): Promise<NLPTaskParseResponse> {
    const parseId = uuidv4();
    const startTime = Date.now();

    // Route to appropriate model (Haiku for simple extraction)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.TaskParsing,
      promptLength: request.text.length,
    });

    // Build context-aware prompt
    const contextPrompt = this.buildContextPrompt(request.text, context);

    const providerRequest: ProviderRequest = {
      systemPrompt: TASK_PARSING_SYSTEM_PROMPT,
      prompt: contextPrompt,
      model: routing.model,
      maxTokens: 1000,
      temperature: 0.1, // Low temperature for consistent extraction
    };

    try {
      const response = await providerManager.execute(providerRequest);

      // Track token usage
      if (context?.firmId) {
        await tokenTracker.recordUsage({
          userId: context.userId,
          firmId: context.firmId,
          operationType: AIOperationType.TaskParsing,
          modelUsed: response.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: response.latencyMs,
          cached: false,
        });
      }

      // Parse AI response
      const parsed = parseAIResponse(response.content);
      if (!parsed) {
        return this.createErrorResponse(parseId, request.text, 'Failed to parse AI response');
      }

      // Build response
      return this.buildResponse(parseId, request.text, parsed);
    } catch (error) {
      console.error('Task parsing error:', error);
      return this.createErrorResponse(
        parseId,
        request.text,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Build context-aware prompt with additional information
   */
  private buildContextPrompt(text: string, context?: TaskParseContext): string {
    const currentDate = getCurrentDateForContext();
    let prompt = `Current date: ${currentDate}\n\n`;
    prompt += `Parse the following task description:\n"${text}"\n\n`;

    if (context) {
      if (context.activeCaseIds && context.activeCaseIds.length > 0) {
        prompt += `User's active cases: ${context.activeCaseIds.length} cases\n`;
      }
      if (context.teamMemberNames && context.teamMemberNames.length > 0) {
        prompt += `Team members: ${context.teamMemberNames.join(', ')}\n`;
      }
    }

    return prompt;
  }

  /**
   * Build NLPTaskParseResponse from AI output
   */
  private buildResponse(
    parseId: string,
    originalText: string,
    parsed: Record<string, unknown>
  ): NLPTaskParseResponse {
    const detectedLanguage = (parsed.detectedLanguage as 'ro' | 'en') || 'en';
    const parsedTask =
      (parsed.parsedTask as Record<string, { value: unknown; confidence: number }>) || {};
    const entities = (parsed.entities as ParsedEntity[]) || [];
    const overallConfidence = (parsed.overallConfidence as number) || 0.5;

    // Build parsed task fields
    const taskFields = this.buildParsedTaskFields(parsedTask);

    // Check if any clarifications are needed (low confidence or missing required fields)
    const clarificationsNeeded = this.detectClarificationsNeeded(taskFields, detectedLanguage);

    return {
      parseId,
      originalText,
      detectedLanguage,
      parsedTask: taskFields,
      entities: this.normalizeEntities(entities),
      overallConfidence,
      clarificationsNeeded,
      isComplete: clarificationsNeeded.length === 0 && overallConfidence >= 0.5,
    };
  }

  /**
   * Build ParsedTaskFields from AI output
   */
  private buildParsedTaskFields(
    parsed: Record<string, { value: unknown; confidence: number }>
  ): ParsedTaskFields {
    const getField = <T>(
      key: string,
      defaultValue: T | null = null
    ): { value: T | null; confidence: number } => {
      const field = parsed[key];
      if (!field) {
        return { value: defaultValue, confidence: 0 };
      }
      return {
        value: field.value as T | null,
        confidence: field.confidence || 0,
      };
    };

    // Parse date string to Date object if present
    const dueDateField = getField<string>('dueDate');
    const parsedDueDate: { value: Date | null; confidence: number } = {
      value: dueDateField.value ? new Date(dueDateField.value) : null,
      confidence: dueDateField.confidence,
    };

    return {
      taskType: getField<TaskType>('taskType'),
      title: getField<string>('title'),
      description: getField<string>('description'),
      dueDate: parsedDueDate,
      dueTime: getField<string>('dueTime'),
      priority: getField<TaskPriority>('priority', 'Medium'),
      assigneeName: getField<string>('assigneeName'),
      assigneeId: { value: null, confidence: 0 }, // Will be resolved later
      caseReference: getField<string>('caseReference'),
      caseId: { value: null, confidence: 0 }, // Will be resolved later
    };
  }

  /**
   * Normalize entities from AI response
   */
  private normalizeEntities(entities: ParsedEntity[]): ParsedEntity[] {
    return entities.map((entity) => ({
      type: entity.type as ParsedEntityType,
      value: entity.value || '',
      normalizedValue: entity.normalizedValue,
      startIndex: entity.startIndex || 0,
      endIndex: entity.endIndex || 0,
      confidence: entity.confidence || 0.5,
    }));
  }

  /**
   * Detect if clarifications are needed based on parsed fields
   */
  private detectClarificationsNeeded(
    taskFields: ParsedTaskFields,
    language: 'ro' | 'en'
  ): NLPTaskParseResponse['clarificationsNeeded'] {
    const clarifications: NLPTaskParseResponse['clarificationsNeeded'] = [];

    // Check task type - required field
    if (!taskFields.taskType.value || taskFields.taskType.confidence < 0.5) {
      clarifications.push({
        id: uuidv4(),
        entityType: 'taskType',
        question:
          language === 'ro'
            ? 'Ce tip de sarcină doriți să creați?'
            : 'What type of task do you want to create?',
        options: [
          { value: 'Meeting', label: language === 'ro' ? 'Întâlnire' : 'Meeting' },
          { value: 'CourtDate', label: language === 'ro' ? 'Termen Instanță' : 'Court Date' },
          { value: 'Research', label: language === 'ro' ? 'Cercetare' : 'Research' },
          {
            value: 'DocumentCreation',
            label: language === 'ro' ? 'Creare Document' : 'Document Creation',
          },
        ],
        allowFreeText: false,
      });
    }

    return clarifications;
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    parseId: string,
    originalText: string,
    errorMessage: string
  ): NLPTaskParseResponse {
    const emptyField = <T>(): { value: T | null; confidence: number } => ({
      value: null,
      confidence: 0,
    });

    return {
      parseId,
      originalText,
      detectedLanguage: 'en',
      parsedTask: {
        taskType: emptyField<TaskType>(),
        title: emptyField<string>(),
        description: { value: errorMessage, confidence: 0 },
        dueDate: emptyField<Date>(),
        dueTime: emptyField<string>(),
        priority: { value: 'Medium', confidence: 0.5 },
        assigneeName: emptyField<string>(),
        assigneeId: emptyField<string>(),
        caseReference: emptyField<string>(),
        caseId: emptyField<string>(),
      },
      entities: [],
      overallConfidence: 0,
      clarificationsNeeded: [],
      isComplete: false,
    };
  }

  /**
   * Resolve assignee name to user ID
   */
  async resolveAssignee(
    assigneeName: string,
    teamMembers: Array<{ id: string; name: string }>
  ): Promise<{ id: string | null; confidence: number }> {
    if (!assigneeName || teamMembers.length === 0) {
      return { id: null, confidence: 0 };
    }

    const lowerName = assigneeName.toLowerCase();

    // Exact match
    const exactMatch = teamMembers.find((m) => m.name.toLowerCase() === lowerName);
    if (exactMatch) {
      return { id: exactMatch.id, confidence: 1.0 };
    }

    // Partial match (first name or last name)
    const partialMatches = teamMembers.filter((m) => {
      const nameParts = m.name.toLowerCase().split(' ');
      return nameParts.some((part) => part.includes(lowerName) || lowerName.includes(part));
    });

    if (partialMatches.length === 1) {
      return { id: partialMatches[0].id, confidence: 0.8 };
    }

    if (partialMatches.length > 1) {
      // Multiple matches - need clarification
      return { id: null, confidence: 0.3 };
    }

    return { id: null, confidence: 0 };
  }

  /**
   * Resolve case reference to case ID
   */
  async resolveCaseReference(
    caseReference: string,
    activeCases: Array<{ id: string; caseNumber: string; title: string; clientName: string }>
  ): Promise<{ id: string | null; confidence: number }> {
    if (!caseReference || activeCases.length === 0) {
      return { id: null, confidence: 0 };
    }

    const lowerRef = caseReference.toLowerCase();

    // Exact case number match
    const exactMatch = activeCases.find((c) => c.caseNumber.toLowerCase() === lowerRef);
    if (exactMatch) {
      return { id: exactMatch.id, confidence: 1.0 };
    }

    // Partial matches in case number, title, or client name
    const partialMatches = activeCases.filter((c) => {
      return (
        c.caseNumber.toLowerCase().includes(lowerRef) ||
        c.title.toLowerCase().includes(lowerRef) ||
        c.clientName.toLowerCase().includes(lowerRef)
      );
    });

    if (partialMatches.length === 1) {
      return { id: partialMatches[0].id, confidence: 0.8 };
    }

    if (partialMatches.length > 1) {
      return { id: null, confidence: 0.3 };
    }

    return { id: null, confidence: 0 };
  }
}

// Singleton instance
export const taskParser = new TaskParserService();
