/**
 * Task Pattern Learning Service
 * Story 4.1: Natural Language Task Parser
 *
 * Records parsed tasks and learns patterns for autocomplete suggestions
 * Firm-scoped patterns (no cross-firm pattern sharing)
 */

import { PrismaClient, TaskTypeEnum } from '@prisma/client';
import {
  NLPTaskParseResponse,
  TaskCorrections,
  TaskPatternSuggestion,
  TaskType,
} from '@legal-platform/types';

// Initialize Prisma client (will be injected)
let prisma: PrismaClient;

export function initializePatternLearningPrisma(client: PrismaClient) {
  prisma = client;
}

/**
 * Convert TaskType to TaskTypeEnum
 */
function toTaskTypeEnum(taskType: TaskType): TaskTypeEnum {
  switch (taskType) {
    case 'Research':
      return TaskTypeEnum.Research;
    case 'DocumentCreation':
      return TaskTypeEnum.DocumentCreation;
    case 'DocumentRetrieval':
      return TaskTypeEnum.DocumentRetrieval;
    case 'CourtDate':
      return TaskTypeEnum.CourtDate;
    case 'Meeting':
      return TaskTypeEnum.Meeting;
    case 'BusinessTrip':
      return TaskTypeEnum.BusinessTrip;
    default:
      return TaskTypeEnum.Meeting;
  }
}

/**
 * Convert TaskTypeEnum to TaskType
 */
function fromTaskTypeEnum(taskTypeEnum: TaskTypeEnum): TaskType {
  switch (taskTypeEnum) {
    case TaskTypeEnum.Research:
      return 'Research';
    case TaskTypeEnum.DocumentCreation:
      return 'DocumentCreation';
    case TaskTypeEnum.DocumentRetrieval:
      return 'DocumentRetrieval';
    case TaskTypeEnum.CourtDate:
      return 'CourtDate';
    case TaskTypeEnum.Meeting:
      return 'Meeting';
    case TaskTypeEnum.BusinessTrip:
      return 'BusinessTrip';
    default:
      return 'Meeting';
  }
}

export interface RecordParsedTaskInput {
  userId: string;
  firmId: string;
  inputText: string;
  parsedResult: NLPTaskParseResponse;
  wasAccepted: boolean;
  userCorrections?: TaskCorrections;
  finalTaskId?: string;
}

export class TaskPatternLearningService {
  /**
   * Record a parsed task for learning
   */
  async recordParsedTask(input: RecordParsedTaskInput): Promise<void> {
    if (!prisma) {
      console.warn('Pattern learning Prisma not initialized');
      return;
    }

    try {
      // Record in parse history
      await prisma.taskParseHistory.create({
        data: {
          userId: input.userId,
          firmId: input.firmId,
          inputText: input.inputText,
          detectedLanguage: input.parsedResult.detectedLanguage,
          parsedResult: input.parsedResult as unknown as object,
          wasAccepted: input.wasAccepted,
          userCorrections: input.userCorrections as unknown as object,
          finalTaskId: input.finalTaskId,
        },
      });

      // If accepted, update pattern frequency
      if (input.wasAccepted && input.parsedResult.parsedTask.taskType.value) {
        await this.updatePatternFrequency(
          input.firmId,
          input.inputText,
          input.parsedResult.parsedTask.taskType.value
        );
      }
    } catch (error) {
      console.error('Failed to record parsed task:', error);
      // Don't throw - pattern learning should not block task creation
    }
  }

  /**
   * Update pattern frequency for a task type
   */
  private async updatePatternFrequency(
    firmId: string,
    inputText: string,
    taskType: TaskType
  ): Promise<void> {
    // Extract a simple pattern from the input text
    const pattern = this.extractPattern(inputText);
    if (!pattern) return;

    try {
      // Try to find existing pattern
      const existing = await prisma.taskParsePattern.findFirst({
        where: {
          firmId,
          inputPattern: pattern,
          taskType: toTaskTypeEnum(taskType),
        },
      });

      if (existing) {
        // Update frequency and lastUsed
        await prisma.taskParsePattern.update({
          where: { id: existing.id },
          data: {
            frequency: existing.frequency + 1,
            lastUsed: new Date(),
          },
        });
      } else {
        // Create new pattern
        await prisma.taskParsePattern.create({
          data: {
            firmId,
            inputPattern: pattern,
            taskType: toTaskTypeEnum(taskType),
            frequency: 1,
            lastUsed: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to update pattern frequency:', error);
    }
  }

  /**
   * Extract a pattern from input text
   * Normalizes dates, times, and names to placeholders
   */
  private extractPattern(inputText: string): string | null {
    if (!inputText || inputText.length < 5) return null;

    let pattern = inputText.toLowerCase();

    // Replace specific dates with placeholders
    // "15 decembrie" -> "{date}"
    pattern = pattern.replace(/\d{1,2}\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)/gi, '{date}');
    // "December 15" -> "{date}"
    pattern = pattern.replace(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi, '{date}');
    // "15/12" or "12/15" -> "{date}"
    pattern = pattern.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '{date}');

    // Replace times with placeholders
    // "at 2pm", "la ora 14" -> "{time}"
    pattern = pattern.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '{time}');
    pattern = pattern.replace(/\bla\s+ora\s+\d{1,2}(:\d{2})?/gi, '{time}');

    // Keep common task-related words, normalize the rest
    // Don't normalize too much - we want to match similar patterns
    pattern = pattern.trim();

    // Pattern should be at least 10 chars after normalization
    return pattern.length >= 10 ? pattern : null;
  }

  /**
   * Get pattern suggestions for autocomplete
   */
  async getPatternSuggestions(
    partialInput: string,
    firmId: string,
    limit: number = 5
  ): Promise<TaskPatternSuggestion[]> {
    if (!prisma || !partialInput || partialInput.length < 3) {
      return [];
    }

    try {
      // Find patterns that match the partial input
      const patterns = await prisma.taskParsePattern.findMany({
        where: {
          firmId,
          inputPattern: {
            contains: partialInput.toLowerCase(),
          },
        },
        orderBy: [
          { frequency: 'desc' },
          { lastUsed: 'desc' },
        ],
        take: limit,
      });

      return patterns.map((p) => ({
        id: p.id,
        pattern: this.formatPatternForDisplay(p.inputPattern),
        completedText: p.inputPattern,
        taskType: fromTaskTypeEnum(p.taskType),
        frequency: p.frequency,
        lastUsed: p.lastUsed,
      }));
    } catch (error) {
      console.error('Failed to get pattern suggestions:', error);
      return [];
    }
  }

  /**
   * Format pattern for display (replace placeholders with readable text)
   */
  private formatPatternForDisplay(pattern: string): string {
    return pattern
      .replace(/\{date\}/g, '[data]')
      .replace(/\{time\}/g, '[ora]');
  }

  /**
   * Extract common patterns from parse history for a firm
   * This can be run periodically to discover new patterns
   */
  async extractCommonPatterns(firmId: string): Promise<void> {
    if (!prisma) return;

    try {
      // Get recent successful parses
      const history = await prisma.taskParseHistory.findMany({
        where: {
          firmId,
          wasAccepted: true,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        take: 1000,
      });

      // Group by task type and extract patterns
      const patternCounts: Map<string, { count: number; taskType: TaskType }> = new Map();

      for (const record of history) {
        const result = record.parsedResult as unknown as NLPTaskParseResponse;
        if (result?.parsedTask?.taskType?.value) {
          const pattern = this.extractPattern(record.inputText);
          if (pattern) {
            const key = `${pattern}|${result.parsedTask.taskType.value}`;
            const existing = patternCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              patternCounts.set(key, { count: 1, taskType: result.parsedTask.taskType.value });
            }
          }
        }
      }

      // Update patterns that appear at least 3 times
      for (const [key, value] of patternCounts) {
        if (value.count >= 3) {
          const [pattern, _] = key.split('|');
          await this.updatePatternFrequency(firmId, pattern, value.taskType);
        }
      }
    } catch (error) {
      console.error('Failed to extract common patterns:', error);
    }
  }

  /**
   * Get parse history for a user (for debugging/analytics)
   */
  async getParseHistory(
    userId: string,
    firmId: string,
    limit: number = 20
  ): Promise<unknown[]> {
    if (!prisma) return [];

    try {
      return await prisma.taskParseHistory.findMany({
        where: {
          userId,
          firmId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      console.error('Failed to get parse history:', error);
      return [];
    }
  }
}

// Singleton instance
export const taskPatternLearning = new TaskPatternLearningService();
