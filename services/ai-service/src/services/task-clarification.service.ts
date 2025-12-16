/**
 * Task Clarification Service
 * Story 4.1: Natural Language Task Parser
 *
 * Detects ambiguities in parsed task input and generates clarification questions
 * Supports Romanian and English localization
 */

import { v4 as uuidv4 } from 'uuid';
import {
  NLPTaskParseResponse,
  TaskParseContext,
  ClarificationQuestion,
  ClarificationEntityType,
  ClarificationOption,
  CONFIDENCE_THRESHOLDS,
  TaskType,
} from '@legal-platform/types';

/**
 * Localized strings for clarification questions
 */
const CLARIFICATION_STRINGS = {
  ro: {
    caseQuestion: 'Pentru ce dosar este această sarcină?',
    assigneeQuestion: 'Cui doriți să alocați această sarcină?',
    taskTypeQuestion: 'Ce tip de sarcină doriți să creați?',
    dateQuestion: 'Când trebuie finalizată această sarcină?',
    multipleMatchesHint: 'Am găsit mai multe potriviri',
    otherOption: 'Altul',
    noCaseOption: 'Fără dosar',
    taskTypes: {
      Research: 'Cercetare',
      DocumentCreation: 'Creare Document',
      DocumentRetrieval: 'Căutare Document',
      CourtDate: 'Termen Instanță',
      Meeting: 'Întâlnire',
      BusinessTrip: 'Deplasare',
    },
  },
  en: {
    caseQuestion: 'Which case is this task for?',
    assigneeQuestion: 'Who should this task be assigned to?',
    taskTypeQuestion: 'What type of task do you want to create?',
    dateQuestion: 'When should this task be completed?',
    multipleMatchesHint: 'Multiple matches found',
    otherOption: 'Other',
    noCaseOption: 'No case',
    taskTypes: {
      Research: 'Research',
      DocumentCreation: 'Document Creation',
      DocumentRetrieval: 'Document Retrieval',
      CourtDate: 'Court Date',
      Meeting: 'Meeting',
      BusinessTrip: 'Business Trip',
    },
  },
};

/**
 * Context data for clarification
 */
export interface ClarificationContext {
  activeCases?: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
  }>;
  teamMembers?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export class TaskClarificationService {
  /**
   * Detect ambiguities in parsed result and generate clarification questions
   */
  detectAmbiguities(
    parsed: NLPTaskParseResponse,
    context: ClarificationContext
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const lang = parsed.detectedLanguage;
    const strings = CLARIFICATION_STRINGS[lang];

    // Check for missing case reference when user has multiple active cases
    if (this.needsCaseClarification(parsed, context)) {
      questions.push(this.createCaseQuestion(context, strings, lang));
    }

    // Check for ambiguous assignee
    if (this.needsAssigneeClarification(parsed, context)) {
      questions.push(this.createAssigneeQuestion(parsed, context, strings, lang));
    }

    // Check for unclear task type
    if (this.needsTaskTypeClarification(parsed)) {
      questions.push(this.createTaskTypeQuestion(strings, lang));
    }

    // Check for ambiguous date reference
    if (this.needsDateClarification(parsed)) {
      questions.push(this.createDateQuestion(strings, lang));
    }

    return questions;
  }

  /**
   * Check if case clarification is needed
   */
  private needsCaseClarification(
    parsed: NLPTaskParseResponse,
    context: ClarificationContext
  ): boolean {
    // No case reference provided and user has multiple active cases
    const noCaseReference =
      !parsed.parsedTask.caseReference.value ||
      parsed.parsedTask.caseReference.confidence < CONFIDENCE_THRESHOLDS.MEDIUM;

    const hasMultipleCases = (context.activeCases?.length ?? 0) > 1;

    return noCaseReference && hasMultipleCases;
  }

  /**
   * Check if assignee clarification is needed
   */
  private needsAssigneeClarification(
    parsed: NLPTaskParseResponse,
    context: ClarificationContext
  ): boolean {
    const assigneeName = parsed.parsedTask.assigneeName.value;
    if (!assigneeName) {
      return false; // No assignee mentioned, not ambiguous
    }

    // Low confidence suggests ambiguity
    if (parsed.parsedTask.assigneeName.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
      return true;
    }

    // Check for multiple matches in team members
    if (context.teamMembers && context.teamMembers.length > 0) {
      const lowerName = assigneeName.toLowerCase();
      const matches = context.teamMembers.filter((m) => {
        const memberNameLower = m.name.toLowerCase();
        return (
          memberNameLower.includes(lowerName) || lowerName.includes(memberNameLower.split(' ')[0])
        );
      });
      return matches.length > 1;
    }

    return false;
  }

  /**
   * Check if task type clarification is needed
   */
  private needsTaskTypeClarification(parsed: NLPTaskParseResponse): boolean {
    return (
      !parsed.parsedTask.taskType.value ||
      parsed.parsedTask.taskType.confidence < CONFIDENCE_THRESHOLDS.MEDIUM
    );
  }

  /**
   * Check if date clarification is needed
   */
  private needsDateClarification(parsed: NLPTaskParseResponse): boolean {
    // Only ask for clarification if date was mentioned but low confidence
    const hasDateEntity = parsed.entities.some((e) => e.type === 'date');
    const lowConfidence = parsed.parsedTask.dueDate.confidence < CONFIDENCE_THRESHOLDS.MEDIUM;

    return hasDateEntity && lowConfidence;
  }

  /**
   * Create case selection question
   */
  private createCaseQuestion(
    context: ClarificationContext,
    strings: (typeof CLARIFICATION_STRINGS)['en'],
    lang: 'ro' | 'en'
  ): ClarificationQuestion {
    const options: ClarificationOption[] = [];

    // Add active cases as options (limit to 4 most recent)
    const cases = (context.activeCases || []).slice(0, 4);
    for (const c of cases) {
      options.push({
        value: c.id,
        label: c.caseNumber,
        context: `${c.title} - ${c.clientName}`,
      });
    }

    return {
      id: uuidv4(),
      entityType: 'case' as ClarificationEntityType,
      question: strings.caseQuestion,
      options: options.length > 0 ? options : undefined,
      allowFreeText: true,
    };
  }

  /**
   * Create assignee selection question
   */
  private createAssigneeQuestion(
    parsed: NLPTaskParseResponse,
    context: ClarificationContext,
    strings: (typeof CLARIFICATION_STRINGS)['en'],
    lang: 'ro' | 'en'
  ): ClarificationQuestion {
    const options: ClarificationOption[] = [];
    const assigneeName = parsed.parsedTask.assigneeName.value?.toLowerCase() || '';

    // Find matching team members
    if (context.teamMembers) {
      const matches = context.teamMembers.filter((m) => {
        const memberNameLower = m.name.toLowerCase();
        return (
          memberNameLower.includes(assigneeName) ||
          assigneeName.includes(memberNameLower.split(' ')[0])
        );
      });

      // Add matching team members as options (limit to 4)
      for (const m of matches.slice(0, 4)) {
        options.push({
          value: m.id,
          label: m.name,
          context: m.role,
        });
      }
    }

    return {
      id: uuidv4(),
      entityType: 'assignee' as ClarificationEntityType,
      question:
        strings.assigneeQuestion + (options.length > 1 ? ` (${strings.multipleMatchesHint})` : ''),
      options: options.length > 0 ? options : undefined,
      allowFreeText: true,
    };
  }

  /**
   * Create task type selection question
   */
  private createTaskTypeQuestion(
    strings: (typeof CLARIFICATION_STRINGS)['en'],
    lang: 'ro' | 'en'
  ): ClarificationQuestion {
    const taskTypeStrings = strings.taskTypes;

    const options: ClarificationOption[] = [
      { value: 'Meeting', label: taskTypeStrings.Meeting },
      { value: 'CourtDate', label: taskTypeStrings.CourtDate },
      { value: 'Research', label: taskTypeStrings.Research },
      { value: 'DocumentCreation', label: taskTypeStrings.DocumentCreation },
    ];

    return {
      id: uuidv4(),
      entityType: 'taskType' as ClarificationEntityType,
      question: strings.taskTypeQuestion,
      options,
      allowFreeText: false,
    };
  }

  /**
   * Create date clarification question
   */
  private createDateQuestion(
    strings: (typeof CLARIFICATION_STRINGS)['en'],
    lang: 'ro' | 'en'
  ): ClarificationQuestion {
    return {
      id: uuidv4(),
      entityType: 'date' as ClarificationEntityType,
      question: strings.dateQuestion,
      options: undefined, // Date will be entered as free text or via date picker
      allowFreeText: true,
    };
  }

  /**
   * Apply clarification answer to parsed result
   */
  applyClarification(
    parsed: NLPTaskParseResponse,
    questionId: string,
    answer: string,
    context?: ClarificationContext
  ): NLPTaskParseResponse {
    // Find the question in clarificationsNeeded
    const question = parsed.clarificationsNeeded.find((q) => q.id === questionId);
    if (!question) {
      return parsed;
    }

    // Create updated parsed result
    const updated: NLPTaskParseResponse = {
      ...parsed,
      parsedTask: { ...parsed.parsedTask },
      clarificationsNeeded: parsed.clarificationsNeeded.filter((q) => q.id !== questionId),
    };

    // Apply answer based on entity type
    switch (question.entityType) {
      case 'case':
        updated.parsedTask.caseId = { value: answer, confidence: 1.0 };
        break;
      case 'assignee':
        updated.parsedTask.assigneeId = { value: answer, confidence: 1.0 };
        // Try to resolve name from context
        if (context?.teamMembers) {
          const member = context.teamMembers.find((m) => m.id === answer);
          if (member) {
            updated.parsedTask.assigneeName = { value: member.name, confidence: 1.0 };
          }
        }
        break;
      case 'taskType':
        updated.parsedTask.taskType = { value: answer as TaskType, confidence: 1.0 };
        break;
      case 'date':
        try {
          const parsedDate = new Date(answer);
          if (!isNaN(parsedDate.getTime())) {
            updated.parsedTask.dueDate = { value: parsedDate, confidence: 1.0 };
          }
        } catch {
          // Keep original date if parsing fails
        }
        break;
    }

    // Update isComplete status
    updated.isComplete =
      updated.clarificationsNeeded.length === 0 && this.hasRequiredFields(updated);

    return updated;
  }

  /**
   * Check if all required fields are present
   */
  private hasRequiredFields(parsed: NLPTaskParseResponse): boolean {
    return Boolean(parsed.parsedTask.taskType.value && parsed.parsedTask.title.value);
  }

  /**
   * Get localized strings for a language
   */
  getLocalizedStrings(lang: 'ro' | 'en'): (typeof CLARIFICATION_STRINGS)['en'] {
    return CLARIFICATION_STRINGS[lang];
  }
}

// Singleton instance
export const taskClarification = new TaskClarificationService();
