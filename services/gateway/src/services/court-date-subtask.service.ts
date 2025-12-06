/**
 * Court Date Subtask Service
 * Story 4.2: Task Type System Implementation
 *
 * Auto-generates preparation subtasks for Court Date tasks
 */

import { prisma } from '@legal-platform/database';
import {
  Task as PrismaTask,
  TaskTypeEnum,
  TaskStatus,
  TaskPriority,
} from '@prisma/client';
import { COURT_DATE_PREP_SUBTASKS } from '@legal-platform/types';

export class CourtDateSubtaskService {
  /**
   * Generate preparation subtasks for a Court Date task
   * Calculates due dates based on hearing date and skips past-due subtasks
   */
  async generatePreparationSubtasks(
    courtDateTask: PrismaTask
  ): Promise<PrismaTask[]> {
    // Verify task is a CourtDate type
    if (courtDateTask.type !== TaskTypeEnum.CourtDate) {
      throw new Error('Task must be of type CourtDate');
    }

    const hearingDate = courtDateTask.dueDate;
    const currentDate = new Date();
    const subtasksCreated: PrismaTask[] = [];

    // Get hearing type from metadata for template replacement
    const metadata = courtDateTask.typeMetadata as Record<string, unknown> | null;
    const hearingType = metadata?.hearingType as string || 'hearing';

    // Generate each subtask from template
    for (const template of COURT_DATE_PREP_SUBTASKS) {
      // Calculate subtask due date (X days before hearing)
      const subtaskDueDate = new Date(hearingDate);
      subtaskDueDate.setDate(subtaskDueDate.getDate() - template.daysBeforeHearing);

      // Skip if due date is in the past
      if (subtaskDueDate < currentDate) {
        continue;
      }

      // Replace {hearingType} placeholder in title
      const title = template.titleTemplate.replace('{hearingType}', hearingType);

      // Create subtask
      const subtask = await prisma.task.create({
        data: {
          firmId: courtDateTask.firmId,
          caseId: courtDateTask.caseId,
          type: TaskTypeEnum.DocumentCreation, // Subtasks are generic DocumentCreation tasks
          title,
          description: template.description,
          assignedTo: courtDateTask.assignedTo,
          dueDate: subtaskDueDate,
          priority: TaskPriority.High, // Court date prep is high priority
          status: TaskStatus.Pending,
          parentTaskId: courtDateTask.id,
          createdBy: courtDateTask.createdBy,
        },
      });

      subtasksCreated.push(subtask);
    }

    // Update parent task metadata with subtask IDs
    const subtaskIds = subtasksCreated.map(s => s.id);
    const updatedMetadata = {
      ...(metadata || {}),
      preparationSubtaskIds: subtaskIds,
    };

    await prisma.task.update({
      where: { id: courtDateTask.id },
      data: {
        typeMetadata: updatedMetadata as any,
      },
    });

    return subtasksCreated;
  }

  /**
   * Check if a Court Date task already has generated subtasks
   */
  async hasGeneratedSubtasks(taskId: string): Promise<boolean> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { typeMetadata: true },
    });

    if (!task) return false;

    const metadata = task.typeMetadata as Record<string, unknown> | null;
    return !!metadata?.preparationSubtaskIds;
  }
}
