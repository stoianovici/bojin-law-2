/**
 * Pattern Detection Service
 * Story 4.7: Task Analytics and Optimization - Task 10
 *
 * AI identifies frequently co-occurring tasks for template creation (AC: 4)
 *
 * Business Logic:
 * - Analyze tasks created together on the same case within a time window
 * - Detect sequence patterns (tasks that follow each other)
 * - Minimum 3 occurrences to suggest a pattern
 * - Confidence threshold: 0.6 minimum, 0.8 for high confidence
 *
 * Performance:
 * - Limit analysis to last 90 days
 * - Store detected patterns in TaskPatternAnalysis table
 */

import { PrismaClient as PrismaClientType, TaskTypeEnum, CaseType, TaskPatternType } from '@prisma/client';
import type {
  PatternDetectionResponse,
  TaskCoOccurrencePattern,
  CreateTemplateFromPatternInput,
  PatternAssignee,
  PatternSampleCase,
  TaskType,
} from '@legal-platform/types';

// Minimum occurrences to consider a pattern
const MIN_OCCURRENCES = 3;
// Confidence thresholds
const MIN_CONFIDENCE = 0.6;
const HIGH_CONFIDENCE = 0.8;
// Time window for co-occurrence (hours)
const CO_OCCURRENCE_WINDOW_HOURS = 24;
// Pattern expiration (days)
const PATTERN_EXPIRATION_DAYS = 30;

interface TaskForPattern {
  id: string;
  type: TaskTypeEnum;
  caseId: string;
  assignedTo: string;
  createdAt: Date;
  case: {
    type: CaseType;
  };
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface CoOccurrenceGroup {
  taskTypes: TaskTypeEnum[];
  caseTypes: Set<CaseType>;
  cases: Set<string>;
  assignees: Map<string, { name: string; count: number }>;
  occurrences: number;
  avgGapHours: number;
}

/**
 * Pattern Detection Service
 * Detects task co-occurrence patterns for template suggestions
 */
export class PatternDetectionService {
  private prisma: PrismaClientType;

  constructor(prismaClient?: PrismaClientType) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Detect task patterns for a firm
   * AC: 4 - AI identifies frequently co-occurring tasks
   */
  async detectTaskPatterns(firmId: string): Promise<PatternDetectionResponse> {
    // Get stored patterns that aren't expired or dismissed
    const existingPatterns = await this.getStoredPatterns(firmId);

    // If we have recent patterns, return them
    const recentPatterns = existingPatterns.filter(
      (p) => new Date(p.analyzedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    if (recentPatterns.length > 0) {
      return this.formatPatternResponse(recentPatterns);
    }

    // Analyze new patterns
    const tasks = await this.getTasksForAnalysis(firmId);
    const coOccurrences = this.findCoOccurrences(tasks);
    const sequencePatterns = this.findSequencePatterns(tasks);

    // Combine and store patterns
    const allPatterns = [...coOccurrences, ...sequencePatterns];
    const storedPatterns = await this.storePatterns(firmId, allPatterns);

    return this.formatPatternResponse(storedPatterns);
  }

  /**
   * Get stored patterns for a firm
   */
  private async getStoredPatterns(firmId: string) {
    return this.prisma.taskPatternAnalysis.findMany({
      where: {
        firmId,
        isDismissed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Get tasks for pattern analysis (last 90 days)
   */
  private async getTasksForAnalysis(firmId: string): Promise<TaskForPattern[]> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    return this.prisma.task.findMany({
      where: {
        firmId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        type: true,
        caseId: true,
        assignedTo: true,
        createdAt: true,
        case: {
          select: { type: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find co-occurring task patterns
   * Tasks created on the same case within a time window
   */
  findCoOccurrences(tasks: TaskForPattern[]): CoOccurrenceGroup[] {
    // Group tasks by case
    const tasksByCase = new Map<string, TaskForPattern[]>();
    for (const task of tasks) {
      const existing = tasksByCase.get(task.caseId) || [];
      existing.push(task);
      tasksByCase.set(task.caseId, existing);
    }

    // Find task type combinations that occur together
    const patternCounts = new Map<string, CoOccurrenceGroup>();

    for (const [caseId, caseTasks] of tasksByCase) {
      // Sort by creation time
      const sorted = caseTasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Find tasks created within the time window
      for (let i = 0; i < sorted.length; i++) {
        const windowTasks: TaskForPattern[] = [sorted[i]];
        const windowEnd = sorted[i].createdAt.getTime() + CO_OCCURRENCE_WINDOW_HOURS * 60 * 60 * 1000;

        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].createdAt.getTime() <= windowEnd) {
            windowTasks.push(sorted[j]);
          } else {
            break;
          }
        }

        // If multiple tasks in window, record the combination
        if (windowTasks.length >= 2) {
          const typeSet = new Set(windowTasks.map((t) => t.type));
          if (typeSet.size >= 2) {
            const sortedTypes = Array.from(typeSet).sort();
            const patternKey = sortedTypes.join(',');

            const existing = patternCounts.get(patternKey);
            if (existing) {
              existing.occurrences++;
              existing.caseTypes.add(windowTasks[0].case.type);
              existing.cases.add(caseId);
              for (const task of windowTasks) {
                const assignee = existing.assignees.get(task.assignedTo);
                if (assignee) {
                  assignee.count++;
                } else {
                  existing.assignees.set(task.assignedTo, {
                    name: `${task.assignee.firstName} ${task.assignee.lastName}`,
                    count: 1,
                  });
                }
              }
            } else {
              const assignees = new Map<string, { name: string; count: number }>();
              for (const task of windowTasks) {
                assignees.set(task.assignedTo, { name: `${task.assignee.firstName} ${task.assignee.lastName}`, count: 1 });
              }
              patternCounts.set(patternKey, {
                taskTypes: sortedTypes as TaskTypeEnum[],
                caseTypes: new Set([windowTasks[0].case.type]),
                cases: new Set([caseId]),
                assignees,
                occurrences: 1,
                avgGapHours: 0,
              });
            }
          }
        }
      }
    }

    // Filter by minimum occurrences
    return Array.from(patternCounts.values()).filter((p) => p.occurrences >= MIN_OCCURRENCES);
  }

  /**
   * Find sequence patterns (tasks that frequently follow each other)
   */
  findSequencePatterns(tasks: TaskForPattern[]): CoOccurrenceGroup[] {
    // Group tasks by case
    const tasksByCase = new Map<string, TaskForPattern[]>();
    for (const task of tasks) {
      const existing = tasksByCase.get(task.caseId) || [];
      existing.push(task);
      tasksByCase.set(task.caseId, existing);
    }

    // Track type sequences (A -> B)
    const sequenceCounts = new Map<string, CoOccurrenceGroup & { totalGapHours: number }>();

    for (const [caseId, caseTasks] of tasksByCase) {
      // Sort by creation time
      const sorted = caseTasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Look at consecutive pairs
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        // Skip if same type
        if (current.type === next.type) continue;

        // Only consider if within 7 days
        const gapMs = next.createdAt.getTime() - current.createdAt.getTime();
        const gapHours = gapMs / (1000 * 60 * 60);
        if (gapHours > 7 * 24) continue;

        const sequenceKey = `${current.type}->${next.type}`;
        const existing = sequenceCounts.get(sequenceKey);

        if (existing) {
          existing.occurrences++;
          existing.totalGapHours += gapHours;
          existing.avgGapHours = existing.totalGapHours / existing.occurrences;
          existing.caseTypes.add(current.case.type);
          existing.cases.add(caseId);

          // Track assignees
          for (const task of [current, next]) {
            const assignee = existing.assignees.get(task.assignedTo);
            if (assignee) {
              assignee.count++;
            } else {
              existing.assignees.set(task.assignedTo, {
                name: `${task.assignee.firstName} ${task.assignee.lastName}`,
                count: 1,
              });
            }
          }
        } else {
          const assignees = new Map<string, { name: string; count: number }>();
          assignees.set(current.assignedTo, { name: `${current.assignee.firstName} ${current.assignee.lastName}`, count: 1 });
          if (current.assignedTo !== next.assignedTo) {
            assignees.set(next.assignedTo, { name: `${next.assignee.firstName} ${next.assignee.lastName}`, count: 1 });
          }

          sequenceCounts.set(sequenceKey, {
            taskTypes: [current.type, next.type],
            caseTypes: new Set([current.case.type]),
            cases: new Set([caseId]),
            assignees,
            occurrences: 1,
            avgGapHours: gapHours,
            totalGapHours: gapHours,
          });
        }
      }
    }

    // Filter by minimum occurrences
    return Array.from(sequenceCounts.values())
      .filter((p) => p.occurrences >= MIN_OCCURRENCES)
      .map(({ totalGapHours: _unused, ...rest }) => rest);
  }

  /**
   * Calculate confidence score for a pattern
   */
  private calculateConfidence(
    occurrences: number,
    uniqueCases: number,
    totalCasesWithTypes: number
  ): number {
    // Confidence based on:
    // 1. Number of occurrences (more = higher)
    // 2. Ratio of cases with pattern vs cases with those task types

    const occurrenceScore = Math.min(occurrences / 10, 1) * 0.5; // Max 0.5
    const coverageScore = totalCasesWithTypes > 0 ? (uniqueCases / totalCasesWithTypes) * 0.5 : 0;

    return Math.round((occurrenceScore + coverageScore) * 100) / 100;
  }

  /**
   * Generate template name suggestion
   */
  generateTemplateSuggestion(pattern: CoOccurrenceGroup): string {
    const typeNames = pattern.taskTypes.map((t) => this.formatTaskTypeName(t));

    if (typeNames.length === 2) {
      return `${typeNames[0]} with ${typeNames[1]}`;
    }

    return typeNames.slice(0, -1).join(', ') + ' and ' + typeNames[typeNames.length - 1];
  }

  /**
   * Format task type name for display
   */
  private formatTaskTypeName(type: TaskTypeEnum): string {
    // Convert enum to readable name
    switch (type) {
      case TaskTypeEnum.Research:
        return 'Research';
      case TaskTypeEnum.DocumentCreation:
        return 'Document Creation';
      case TaskTypeEnum.DocumentRetrieval:
        return 'Document Retrieval';
      case TaskTypeEnum.CourtDate:
        return 'Court Date';
      case TaskTypeEnum.Meeting:
        return 'Meeting';
      case TaskTypeEnum.BusinessTrip:
        return 'Business Trip';
      default:
        return String(type);
    }
  }

  /**
   * Store detected patterns in database
   */
  private async storePatterns(
    firmId: string,
    patterns: CoOccurrenceGroup[]
  ): Promise<Awaited<ReturnType<typeof this.prisma.taskPatternAnalysis.findMany>>> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PATTERN_EXPIRATION_DAYS);

    // Get total cases for confidence calculation
    const totalCases = await this.prisma.case.count({ where: { firmId } });

    const createdPatterns = [];

    for (const pattern of patterns) {
      const confidence = this.calculateConfidence(
        pattern.occurrences,
        pattern.cases.size,
        totalCases
      );

      // Skip low confidence patterns
      if (confidence < MIN_CONFIDENCE) continue;

      const patternType =
        pattern.avgGapHours > 0 ? TaskPatternType.Sequence : TaskPatternType.CoOccurrence;

      // Check if similar pattern exists
      const existing = await this.prisma.taskPatternAnalysis.findFirst({
        where: {
          firmId,
          taskTypes: { equals: pattern.taskTypes },
          patternType,
        },
      });

      if (existing) {
        // Update existing
        const updated = await this.prisma.taskPatternAnalysis.update({
          where: { id: existing.id },
          data: {
            occurrenceCount: pattern.occurrences,
            confidence,
            caseTypes: Array.from(pattern.caseTypes),
            commonAssignees: Array.from(pattern.assignees.keys()),
            avgSequenceGap: pattern.avgGapHours > 0 ? pattern.avgGapHours / 24 : null,
            expiresAt,
            analyzedAt: new Date(),
          },
        });
        createdPatterns.push(updated);
      } else {
        // Create new
        const created = await this.prisma.taskPatternAnalysis.create({
          data: {
            firmId,
            patternType,
            taskTypes: pattern.taskTypes,
            caseTypes: Array.from(pattern.caseTypes),
            occurrenceCount: pattern.occurrences,
            confidence,
            suggestedName: this.generateTemplateSuggestion(pattern),
            avgSequenceGap: pattern.avgGapHours > 0 ? pattern.avgGapHours / 24 : null,
            commonAssignees: Array.from(pattern.assignees.keys()),
            expiresAt,
          },
        });
        createdPatterns.push(created);
      }
    }

    return createdPatterns;
  }

  /**
   * Format stored patterns for response
   */
  private async formatPatternResponse(
    patterns: Awaited<ReturnType<typeof this.prisma.taskPatternAnalysis.findMany>>
  ): Promise<PatternDetectionResponse> {
    const formattedPatterns: TaskCoOccurrencePattern[] = [];

    for (const pattern of patterns) {
      // Get assignee names
      const assignees = await this.prisma.user.findMany({
        where: { id: { in: pattern.commonAssignees } },
        select: { id: true, firstName: true, lastName: true },
      });

      // Get sample cases
      const sampleCases = await this.getSampleCases(pattern.taskTypes as string[], 3);

      formattedPatterns.push({
        id: pattern.id,
        taskTypes: pattern.taskTypes as unknown as TaskType[],
        caseTypes: pattern.caseTypes as unknown as import('@legal-platform/types').CaseType[],
        occurrenceCount: pattern.occurrenceCount,
        confidence: Number(pattern.confidence),
        suggestedTemplateName: pattern.suggestedName || '',
        avgSequenceGapDays: pattern.avgSequenceGap ? Number(pattern.avgSequenceGap) : undefined,
        commonAssignees: assignees.map((a) => ({
          userId: a.id,
          userName: `${a.firstName} ${a.lastName}`,
          frequency: 0, // We don't track per-pattern frequency
        })),
        sampleCases,
        isTemplateCreated: pattern.isTemplateCreated,
      });
    }

    return {
      patterns: formattedPatterns,
      analysisDate: new Date(),
      totalPatternsFound: formattedPatterns.length,
      highConfidenceCount: formattedPatterns.filter((p) => p.confidence >= HIGH_CONFIDENCE).length,
    };
  }

  /**
   * Get sample cases for a pattern
   */
  private async getSampleCases(
    taskTypes: string[],
    limit: number
  ): Promise<PatternSampleCase[]> {
    // Find cases that have all the task types
    const cases = await this.prisma.case.findMany({
      where: {
        tasks: {
          some: {
            type: { in: taskTypes as TaskTypeEnum[] },
          },
        },
      },
      select: { id: true, title: true },
      take: limit,
    });

    return cases.map((c) => ({ caseId: c.id, caseTitle: c.title }));
  }

  /**
   * Create template from detected pattern
   * AC: 4 - Convert pattern to template
   */
  async createTemplateFromPattern(
    input: CreateTemplateFromPatternInput,
    userId: string
  ): Promise<{ id: string; name: string }> {
    // Get the pattern
    const pattern = await this.prisma.taskPatternAnalysis.findUnique({
      where: { id: input.patternId },
    });

    if (!pattern) {
      throw new Error('Pattern not found');
    }

    // Create the template
    const template = await this.prisma.taskTemplate.create({
      data: {
        firmId: pattern.firmId,
        name: input.templateName,
        description: input.description || `Auto-generated from detected pattern`,
        createdBy: userId,
        steps: {
          create: pattern.taskTypes.map((type, index) => ({
            stepOrder: index + 1,
            taskType: type as TaskTypeEnum,
            title: `${this.formatTaskTypeName(type as TaskTypeEnum)} task`,
            offsetDays: index * (pattern.avgSequenceGap ? Number(pattern.avgSequenceGap) : 1),
          })),
        },
      },
      select: { id: true, name: true },
    });

    // Mark pattern as template created
    await this.prisma.taskPatternAnalysis.update({
      where: { id: input.patternId },
      data: {
        isTemplateCreated: true,
        templateId: template.id,
      },
    });

    return template;
  }

  /**
   * Dismiss a pattern (won't show again)
   */
  async dismissPattern(patternId: string): Promise<boolean> {
    await this.prisma.taskPatternAnalysis.update({
      where: { id: patternId },
      data: { isDismissed: true },
    });
    return true;
  }

  /**
   * Get a single pattern by ID
   */
  async getPattern(patternId: string): Promise<TaskCoOccurrencePattern | null> {
    const pattern = await this.prisma.taskPatternAnalysis.findUnique({
      where: { id: patternId },
    });

    if (!pattern) return null;

    const response = await this.formatPatternResponse([pattern]);
    return response.patterns[0] || null;
  }
}

// Export singleton
let serviceInstance: PatternDetectionService | null = null;

export function getPatternDetectionService(): PatternDetectionService {
  if (!serviceInstance) {
    serviceInstance = new PatternDetectionService();
  }
  return serviceInstance;
}

export default PatternDetectionService;
