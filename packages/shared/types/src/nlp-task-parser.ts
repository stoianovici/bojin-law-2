/**
 * NLP Task Parser Types
 * Story 4.1: Natural Language Task Parser
 */

import type { TaskType } from './entities';

/**
 * Supported languages for NLP parsing
 */
export type NLPLanguage = 'ro' | 'en' | 'auto';

/**
 * Priority levels for tasks
 */
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

/**
 * Entity types that can be extracted from natural language input
 */
export type ParsedEntityType =
  | 'taskType'
  | 'date'
  | 'time'
  | 'priority'
  | 'person'
  | 'case'
  | 'location'
  | 'duration';

/**
 * Clarification entity types - fields that may need clarification
 */
export type ClarificationEntityType = 'case' | 'assignee' | 'taskType' | 'date';

/**
 * Context provided for task parsing to improve accuracy
 */
export interface TaskParseContext {
  userId: string;
  firmId: string;
  activeCaseIds?: string[]; // User's active cases for context
  teamMemberNames?: string[]; // For assignee matching
  recentTaskPatterns?: string[]; // Recent task types for context
}

/**
 * Request to parse natural language task input
 */
export interface NLPTaskParseRequest {
  text: string;
  language?: NLPLanguage;
  context?: TaskParseContext;
}

/**
 * A field with its parsed value and confidence score
 */
export interface ParsedField<T> {
  value: T | null;
  confidence: number; // 0-1 scale
}

/**
 * All parsed task fields with confidence scores
 */
export interface ParsedTaskFields {
  taskType: ParsedField<TaskType>;
  title: ParsedField<string>;
  description: ParsedField<string>;
  dueDate: ParsedField<Date>;
  dueTime: ParsedField<string>; // HH:mm format
  priority: ParsedField<TaskPriority>;
  assigneeName: ParsedField<string>;
  assigneeId: ParsedField<string>; // Resolved user ID
  caseReference: ParsedField<string>; // Case number or title fragment
  caseId: ParsedField<string>; // Resolved case ID
}

/**
 * An entity extracted from the input text
 */
export interface ParsedEntity {
  type: ParsedEntityType;
  value: string;
  normalizedValue: string | Date | null; // Parsed/normalized value
  startIndex: number;
  endIndex: number;
  confidence: number;
}

/**
 * An option presented for clarification
 */
export interface ClarificationOption {
  value: string;
  label: string;
  context?: string; // Additional info like case number
}

/**
 * A question to clarify ambiguous input
 */
export interface ClarificationQuestion {
  id: string;
  entityType: ClarificationEntityType;
  question: string; // Localized question
  options?: ClarificationOption[];
  allowFreeText: boolean;
}

/**
 * Response from parsing natural language task input
 */
export interface NLPTaskParseResponse {
  parseId: string; // UUID for tracking clarifications
  originalText: string;
  detectedLanguage: 'ro' | 'en';
  parsedTask: ParsedTaskFields;
  entities: ParsedEntity[];
  overallConfidence: number; // 0-1
  clarificationsNeeded: ClarificationQuestion[];
  isComplete: boolean; // True if no clarifications needed
}

/**
 * Request to resolve a clarification question
 */
export interface ClarificationResolutionRequest {
  parseId: string;
  questionId: string;
  answer: string;
}

/**
 * Corrections to apply before task creation
 */
export interface TaskCorrections {
  taskType?: TaskType;
  title?: string;
  description?: string;
  dueDate?: Date;
  dueTime?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  caseId?: string;
}

/**
 * Request to confirm task creation with optional corrections
 */
export interface TaskConfirmationRequest {
  parseId: string;
  corrections?: TaskCorrections;
}

/**
 * A suggestion based on learned patterns
 */
export interface TaskPatternSuggestion {
  id: string;
  pattern: string; // Display text
  completedText: string; // Full text if selected
  taskType: TaskType;
  frequency: number;
  lastUsed: Date;
}

/**
 * Record of a parsed task for pattern learning
 */
export interface TaskParseRecord {
  id: string;
  userId: string;
  firmId: string;
  inputText: string;
  detectedLanguage: 'ro' | 'en';
  parsedResult: NLPTaskParseResponse;
  wasAccepted: boolean;
  userCorrections?: TaskCorrections;
  finalTaskId?: string;
  createdAt: Date;
}

/**
 * A learned pattern for task parsing
 */
export interface TaskParsePatternRecord {
  id: string;
  firmId: string;
  inputPattern: string; // regex pattern
  taskType: TaskType;
  frequency: number;
  lastUsed: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Confidence thresholds for UI display
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8, // Green indicator, auto-fill
  MEDIUM: 0.5, // Yellow indicator, user review recommended
  // Below MEDIUM is LOW - red indicator, clarification required
} as const;

/**
 * Get confidence level based on score
 */
export function getConfidenceLevel(
  confidence: number
): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Factory override types for testing
 */
export type NLPTaskParseRequestOverrides = Partial<NLPTaskParseRequest>;
export type NLPTaskParseResponseOverrides = Partial<NLPTaskParseResponse>;
export type TaskParseContextOverrides = Partial<TaskParseContext>;
export type ParsedTaskFieldsOverrides = Partial<ParsedTaskFields>;
export type ParsedEntityOverrides = Partial<ParsedEntity>;
export type ClarificationQuestionOverrides = Partial<ClarificationQuestion>;
export type TaskPatternSuggestionOverrides = Partial<TaskPatternSuggestion>;
