// Story 4.4: Deadline Cascade Service
// Calculates and applies deadline changes through dependent tasks

import { prisma, Task, DependencyType } from '@legal-platform/database';
import { DeadlineCascadeResult, AffectedTask, DeadlineConflict } from '@legal-platform/types';

// Class wrapper for compatibility with resolvers
export class DeadlineCascadeService {
  analyzeDeadlineChange = analyzeDeadlineChange;
  applyDeadlineCascade = applyDeadlineCascade;
}

// ============================================================================
// Deadline Cascade Analysis (AC: 3)
// ============================================================================

export async function analyzeDeadlineChange(
  taskId: string,
  newDueDate: Date,
  firmId: string
): Promise<DeadlineCascadeResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      successors: {
        include: {
          successor: {
            include: {
              assignee: true,
            },
          },
        },
      },
    },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  const affectedTasks: AffectedTask[] = [];
  const conflicts: DeadlineConflict[] = [];
  const processed = new Set<string>();

  // Recursively calculate new due dates for successors
  await calculateCascade(task, newDueDate, affectedTasks, conflicts, processed);

  // Generate suggested resolution if conflicts exist
  let suggestedResolution: string | undefined;
  if (conflicts.length > 0) {
    const errorCount = conflicts.filter((c) => c.severity === 'Error').length;
    const warningCount = conflicts.filter((c) => c.severity === 'Warning').length;

    if (errorCount > 0) {
      suggestedResolution = `${errorCount} critical conflict(s) detected. Consider extending case deadline or reassigning tasks to resolve conflicts.`;
    } else {
      suggestedResolution = `${warningCount} warning(s) detected. Review affected tasks to ensure timeline feasibility.`;
    }
  }

  return {
    affectedTasks,
    conflicts,
    suggestedResolution,
  };
}

async function calculateCascade(
  task: Task,
  newDueDate: Date,
  affectedTasks: AffectedTask[],
  conflicts: DeadlineConflict[],
  processed: Set<string>
): Promise<void> {
  if (processed.has(task.id)) return;
  processed.add(task.id);

  // Get successors with dependencies
  const successors = await prisma.taskDependency.findMany({
    where: { predecessorId: task.id },
    include: {
      successor: {
        include: {
          assignee: true,
        },
      },
    },
  });

  for (const dependency of successors) {
    const successor = dependency.successor;
    const currentDueDate = new Date(successor.dueDate);

    // Calculate new due date based on dependency type and lag
    let calculatedDueDate = new Date(newDueDate);

    switch (dependency.dependencyType) {
      case 'FinishToStart':
        calculatedDueDate.setDate(calculatedDueDate.getDate() + dependency.lagDays);
        break;
      case 'StartToStart':
        // Successor starts when predecessor starts (no change needed based on finish date)
        continue;
      case 'FinishToFinish':
        // Successor finishes when predecessor finishes
        calculatedDueDate = new Date(newDueDate);
        break;
      case 'StartToFinish':
        // Rare case
        continue;
    }

    const daysDelta = Math.floor(
      (calculatedDueDate.getTime() - currentDueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only track if date actually changes
    if (daysDelta !== 0) {
      affectedTasks.push({
        taskId: successor.id,
        taskTitle: successor.title,
        currentDueDate,
        newDueDate: calculatedDueDate,
        daysDelta,
      });

      // Check for conflicts
      const now = new Date();
      if (calculatedDueDate < now) {
        conflicts.push({
          taskId: successor.id,
          taskTitle: successor.title,
          conflictType: 'PastDeadline',
          message: `New deadline would be in the past (${calculatedDueDate.toLocaleDateString()})`,
          severity: 'Error',
        });
      }

      // Check for assignee overlap conflicts (simplified - check same day)
      const overlappingTasks = await prisma.task.findMany({
        where: {
          assignedTo: successor.assignedTo,
          dueDate: calculatedDueDate,
          id: { not: successor.id },
          status: { not: 'Completed' },
        },
      });

      if (overlappingTasks.length > 0) {
        conflicts.push({
          taskId: successor.id,
          taskTitle: successor.title,
          conflictType: 'OverlapConflict',
          message: `Assignee has ${overlappingTasks.length} other task(s) due on ${calculatedDueDate.toLocaleDateString()}`,
          severity: 'Warning',
        });
      }

      // Recursively cascade to this task's successors
      await calculateCascade(successor, calculatedDueDate, affectedTasks, conflicts, processed);
    }
  }
}

// ============================================================================
// Apply Cascade (AC: 3)
// ============================================================================

export async function applyDeadlineCascade(
  taskId: string,
  newDueDate: Date,
  confirmConflicts: boolean,
  firmId: string
): Promise<Task[]> {
  // First analyze to check for conflicts
  const analysis = await analyzeDeadlineChange(taskId, newDueDate, firmId);

  // If there are errors and user hasn't confirmed, throw error
  const hasErrors = analysis.conflicts.some((c: DeadlineConflict) => c.severity === 'Error');
  if (hasErrors && !confirmConflicts) {
    throw new Error(
      'Critical conflicts detected. Set confirmConflicts=true to apply changes anyway.'
    );
  }

  // Apply changes in a transaction
  const updatedTasks = await prisma.$transaction(async (tx) => {
    // Update the original task
    const originalTask = await tx.task.update({
      where: { id: taskId },
      data: { dueDate: newDueDate },
    });

    const updated: Task[] = [originalTask];

    // Update all affected tasks
    for (const affected of analysis.affectedTasks) {
      const task = await tx.task.update({
        where: { id: affected.taskId },
        data: { dueDate: affected.newDueDate },
      });
      updated.push(task);
    }

    return updated;
  });

  return updatedTasks;
}
