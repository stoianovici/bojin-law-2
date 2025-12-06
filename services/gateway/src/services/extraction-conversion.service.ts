/**
 * Extraction Conversion Service
 * Story 5.2: Communication Intelligence Engine
 *
 * Converts extracted items (deadlines, commitments, action items) into tasks.
 * Handles one-click conversion flow with intelligent field population.
 */

import {
  PrismaClient,
  TaskTypeEnum,
  TaskStatus,
  TaskPriority,
  ExtractionStatus,
} from '@legal-platform/database';

// ============================================================================
// Types
// ============================================================================

export interface ConversionRequest {
  extractionId: string;
  extractionType: 'deadline' | 'commitment' | 'actionItem';
  userId: string;
  firmId: string;
  overrides?: Partial<TaskOverrides>;
}

export interface TaskOverrides {
  title: string;
  description: string;
  assignedTo: string;
  dueDate: Date;
  priority: TaskPriority;
  taskType: TaskTypeEnum;
}

export interface ConversionResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface ConversionSuggestion {
  title: string;
  description: string;
  suggestedAssignee?: string;
  dueDate?: Date;
  priority: TaskPriority;
  taskType: TaskTypeEnum;
  caseId: string | null;
  sourceEmailId: string;
}

// ============================================================================
// Extraction Conversion Service
// ============================================================================

export class ExtractionConversionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get task suggestion from extracted deadline (AC: 2, 4)
   */
  async suggestFromDeadline(deadlineId: string): Promise<ConversionSuggestion | null> {
    const deadline = await this.prisma.extractedDeadline.findUnique({
      where: { id: deadlineId },
      include: {
        email: {
          select: { id: true, from: true, caseId: true },
        },
        case: {
          select: { id: true, title: true, assignedTo: true },
        },
      },
    });

    if (!deadline) return null;

    return {
      title: `Deadline: ${this.truncate(deadline.description, 100)}`,
      description: this.buildDeadlineDescription(deadline),
      suggestedAssignee: deadline.case?.assignedTo || undefined,
      dueDate: deadline.dueDate,
      priority: this.getPriorityFromDate(deadline.dueDate),
      taskType: TaskTypeEnum.CourtDate, // Deadlines often relate to court dates
      caseId: deadline.caseId,
      sourceEmailId: deadline.emailId,
    };
  }

  /**
   * Get task suggestion from extracted commitment
   */
  async suggestFromCommitment(commitmentId: string): Promise<ConversionSuggestion | null> {
    const commitment = await this.prisma.extractedCommitment.findUnique({
      where: { id: commitmentId },
      include: {
        email: {
          select: { id: true, from: true, caseId: true },
        },
        case: {
          select: { id: true, title: true, assignedTo: true },
        },
      },
    });

    if (!commitment) return null;

    return {
      title: `Follow-up: ${this.truncate(commitment.commitmentText, 100)}`,
      description: this.buildCommitmentDescription(commitment),
      suggestedAssignee: commitment.case?.assignedTo || undefined,
      dueDate: commitment.dueDate || undefined,
      priority: commitment.dueDate
        ? this.getPriorityFromDate(commitment.dueDate)
        : TaskPriority.Medium,
      taskType: TaskTypeEnum.Research, // Commitments often require follow-up research
      caseId: commitment.caseId,
      sourceEmailId: commitment.emailId,
    };
  }

  /**
   * Get task suggestion from extracted action item (AC: 4)
   */
  async suggestFromActionItem(actionItemId: string): Promise<ConversionSuggestion | null> {
    const actionItem = await this.prisma.extractedActionItem.findUnique({
      where: { id: actionItemId },
      include: {
        email: {
          select: { id: true, from: true, caseId: true },
        },
        case: {
          select: { id: true, title: true, assignedTo: true },
        },
      },
    });

    if (!actionItem) return null;

    return {
      title: this.truncate(actionItem.description, 100),
      description: this.buildActionItemDescription(actionItem),
      suggestedAssignee: actionItem.suggestedAssignee || actionItem.case?.assignedTo || undefined,
      priority: actionItem.priority,
      taskType: this.inferTaskType(actionItem.description),
      caseId: actionItem.caseId,
      sourceEmailId: actionItem.emailId,
    };
  }

  /**
   * Convert extraction to task (AC: 2, 4)
   */
  async convertToTask(request: ConversionRequest): Promise<ConversionResult> {
    try {
      // Get suggestion based on extraction type
      let suggestion: ConversionSuggestion | null = null;

      switch (request.extractionType) {
        case 'deadline':
          suggestion = await this.suggestFromDeadline(request.extractionId);
          break;
        case 'commitment':
          suggestion = await this.suggestFromCommitment(request.extractionId);
          break;
        case 'actionItem':
          suggestion = await this.suggestFromActionItem(request.extractionId);
          break;
      }

      if (!suggestion) {
        return { success: false, error: 'Extraction not found' };
      }

      if (!suggestion.caseId) {
        return { success: false, error: 'No case associated with extraction' };
      }

      // Apply overrides
      const taskData = {
        title: request.overrides?.title || suggestion.title,
        description: request.overrides?.description || suggestion.description,
        assignedTo: request.overrides?.assignedTo || suggestion.suggestedAssignee || request.userId,
        dueDate: request.overrides?.dueDate || suggestion.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: request.overrides?.priority || suggestion.priority,
        type: request.overrides?.taskType || suggestion.taskType,
      };

      // Create task in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the task
        const task = await tx.task.create({
          data: {
            firmId: request.firmId,
            caseId: suggestion!.caseId!,
            type: taskData.type,
            title: taskData.title,
            description: taskData.description,
            assignedTo: taskData.assignedTo,
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            status: TaskStatus.Pending,
            createdBy: request.userId,
          },
        });

        // Update extraction status
        switch (request.extractionType) {
          case 'deadline':
            await tx.extractedDeadline.update({
              where: { id: request.extractionId },
              data: {
                status: ExtractionStatus.Converted,
                convertedTaskId: task.id,
              },
            });
            break;
          case 'commitment':
            await tx.extractedCommitment.update({
              where: { id: request.extractionId },
              data: {
                status: ExtractionStatus.Converted,
                convertedTaskId: task.id,
              },
            });
            break;
          case 'actionItem':
            await tx.extractedActionItem.update({
              where: { id: request.extractionId },
              data: {
                status: ExtractionStatus.Converted,
                convertedTaskId: task.id,
              },
            });
            break;
        }

        return task;
      });

      return { success: true, taskId: result.id };
    } catch (error) {
      console.error('[Extraction Conversion] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Dismiss extraction (AC: 2)
   */
  async dismissExtraction(
    extractionId: string,
    extractionType: 'deadline' | 'commitment' | 'actionItem' | 'question',
    reason?: string
  ): Promise<boolean> {
    try {
      const updateData = {
        status: ExtractionStatus.Dismissed,
        dismissedAt: new Date(),
        dismissReason: reason,
      };

      switch (extractionType) {
        case 'deadline':
          await this.prisma.extractedDeadline.update({
            where: { id: extractionId },
            data: updateData,
          });
          break;
        case 'commitment':
          await this.prisma.extractedCommitment.update({
            where: { id: extractionId },
            data: updateData,
          });
          break;
        case 'actionItem':
          await this.prisma.extractedActionItem.update({
            where: { id: extractionId },
            data: updateData,
          });
          break;
        case 'question':
          await this.prisma.extractedQuestion.update({
            where: { id: extractionId },
            data: updateData,
          });
          break;
      }

      return true;
    } catch (error) {
      console.error('[Extraction Conversion] Dismiss error:', error);
      return false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private getPriorityFromDate(dueDate: Date): TaskPriority {
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue <= 1) return TaskPriority.Urgent;
    if (daysUntilDue <= 3) return TaskPriority.High;
    if (daysUntilDue <= 7) return TaskPriority.Medium;
    return TaskPriority.Low;
  }

  private inferTaskType(description: string): TaskTypeEnum {
    const lower = description.toLowerCase();

    if (lower.includes('research') || lower.includes('cercetare') || lower.includes('find')) {
      return TaskTypeEnum.Research;
    }
    if (lower.includes('document') || lower.includes('draft') || lower.includes('prepare')) {
      return TaskTypeEnum.DocumentCreation;
    }
    if (lower.includes('meeting') || lower.includes('întâlnire') || lower.includes('call')) {
      return TaskTypeEnum.Meeting;
    }
    if (lower.includes('court') || lower.includes('instanță') || lower.includes('hearing')) {
      return TaskTypeEnum.CourtDate;
    }

    return TaskTypeEnum.Research; // Default
  }

  private buildDeadlineDescription(deadline: {
    description: string;
    confidence: number;
    emailId: string;
  }): string {
    return `Extracted from email communication.

${deadline.description}

---
Confidence: ${Math.round(deadline.confidence * 100)}%
Source: Email ID ${deadline.emailId}`;
  }

  private buildCommitmentDescription(commitment: {
    party: string;
    commitmentText: string;
    confidence: number;
    emailId: string;
  }): string {
    return `Commitment tracking task.

Party: ${commitment.party}
Commitment: ${commitment.commitmentText}

---
Confidence: ${Math.round(commitment.confidence * 100)}%
Source: Email ID ${commitment.emailId}`;
  }

  private buildActionItemDescription(actionItem: {
    description: string;
    suggestedAssignee: string | null;
    confidence: number;
    emailId: string;
  }): string {
    const parts = [
      'Action item extracted from email communication.',
      '',
      actionItem.description,
    ];

    if (actionItem.suggestedAssignee) {
      parts.push('', `Suggested assignee: ${actionItem.suggestedAssignee}`);
    }

    parts.push(
      '',
      '---',
      `Confidence: ${Math.round(actionItem.confidence * 100)}%`,
      `Source: Email ID ${actionItem.emailId}`
    );

    return parts.join('\n');
  }
}

// Factory function
export function createExtractionConversionService(prisma: PrismaClient): ExtractionConversionService {
  return new ExtractionConversionService(prisma);
}
