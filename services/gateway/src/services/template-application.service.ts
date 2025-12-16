// @ts-nocheck
// Story 4.4: Template Application Service
// Applies task templates to cases, creating tasks with dependencies

import { prisma, Task, TaskStatus, TaskPriority } from '@legal-platform/database';
import { ApplyTemplateInput, ApplyTemplateResult } from '@legal-platform/types';

// Class wrapper for compatibility with resolvers
export class TemplateApplicationService {
  applyTemplate = applyTemplate;
  getTemplateUsagesForCase = getTemplateUsagesForCase;
  getTasksFromTemplateUsage = getTasksFromTemplateUsage;
}

// ============================================================================
// Template Application (AC: 1, 2)
// ============================================================================

export async function applyTemplate(
  input: ApplyTemplateInput,
  userId: string,
  firmId: string
): Promise<ApplyTemplateResult> {
  // Fetch template with all steps and dependencies
  const template = await prisma.taskTemplate.findUnique({
    where: { id: input.templateId },
    include: {
      steps: {
        include: {
          dependsOn: true,
        },
        orderBy: {
          stepOrder: 'asc',
        },
      },
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  if (template.firmId !== firmId) {
    throw new Error('Template access denied');
  }

  // Verify case exists and belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: input.caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  const warnings: string[] = [];
  const createdTasks: Task[] = [];
  const stepToTaskMap = new Map<string, string>(); // stepId -> taskId
  let dependenciesCreated = 0;

  await prisma.$transaction(async (tx) => {
    // Step 1: Create all tasks first
    for (const step of template.steps) {
      // Calculate due date based on offset
      let dueDate: Date;
      const startDate = new Date(input.startDate);

      switch (step.offsetFrom) {
        case 'CaseStart':
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + step.offsetDays);
          break;
        case 'PreviousTask':
          // Will be recalculated after dependencies are established
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + step.offsetDays);
          break;
        case 'CaseDeadline':
          // Calculate from case deadline if available
          if (caseRecord.closedDate) {
            dueDate = new Date(caseRecord.closedDate);
            dueDate.setDate(dueDate.getDate() - Math.abs(step.offsetDays));
          } else {
            // Default to start date + offset if no case deadline
            dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + step.offsetDays);
            warnings.push(
              `Step "${step.title}" uses CaseDeadline offset but case has no deadline. Using start date instead.`
            );
          }
          break;
        default:
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + step.offsetDays);
      }

      // Determine assignee (from mapping or use default)
      const assignedTo = input.assignees?.[step.id] || userId;

      // Create task
      const task = await tx.task.create({
        data: {
          firmId,
          caseId: input.caseId,
          type: step.taskType,
          title: step.title,
          description: step.description,
          assignedTo,
          dueDate,
          status: TaskStatus.Pending,
          priority: TaskPriority.Medium,
          estimatedHours: step.estimatedHours,
          typeMetadata: step.typeMetadata as any,
          templateStepId: step.id,
          isCriticalPath: step.isCriticalPath,
          createdBy: userId,
        },
      });

      createdTasks.push(task);
      stepToTaskMap.set(step.id, task.id);
    }

    // Step 2: Create task dependencies based on template dependencies
    for (const step of template.steps) {
      const taskId = stepToTaskMap.get(step.id)!;

      for (const dependency of step.dependsOn) {
        const predecessorTaskId = stepToTaskMap.get(dependency.sourceStepId)!;
        const successorTaskId = taskId;

        await tx.taskDependency.create({
          data: {
            predecessorId: predecessorTaskId,
            successorId: successorTaskId,
            dependencyType: dependency.dependencyType,
            lagDays: dependency.lagDays,
          },
        });

        dependenciesCreated++;
      }
    }

    // Step 3: Recalculate due dates for tasks with PreviousTask offset
    for (const step of template.steps) {
      if (step.offsetFrom === 'PreviousTask' && step.dependsOn.length > 0) {
        const taskId = stepToTaskMap.get(step.id)!;
        const task = createdTasks.find((t) => t.id === taskId)!;

        // Find the predecessor task with latest due date
        const predecessorDueDates = step.dependsOn.map((dep) => {
          const predTask = createdTasks.find((t) => t.id === stepToTaskMap.get(dep.sourceStepId))!;
          const dueDate = new Date(predTask.dueDate);
          dueDate.setDate(dueDate.getDate() + dep.lagDays + step.offsetDays);
          return dueDate;
        });

        const latestPredDate = new Date(Math.max(...predecessorDueDates.map((d) => d.getTime())));

        // Update task due date
        await tx.task.update({
          where: { id: taskId },
          data: { dueDate: latestPredDate },
        });

        // Update in-memory task
        task.dueDate = latestPredDate;
      }
    }

    // Step 4: Create template usage record
    const usage = await tx.taskTemplateUsage.create({
      data: {
        templateId: input.templateId,
        caseId: input.caseId,
        appliedBy: userId,
        taskIds: createdTasks.map((t) => t.id),
      },
    });

    // Update tasks with template usage ID
    await tx.task.updateMany({
      where: { id: { in: createdTasks.map((t) => t.id) } },
      data: { templateUsageId: usage.id },
    });
  });

  return {
    usageId: '', // Will be set in transaction
    createdTasks,
    dependenciesCreated,
    warnings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets all template usages for a case
 */
export async function getTemplateUsagesForCase(caseId: string, firmId: string): Promise<any[]> {
  // Verify case belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  return prisma.taskTemplateUsage.findMany({
    where: { caseId },
    include: {
      template: true,
    },
    orderBy: {
      appliedAt: 'desc',
    },
  });
}

/**
 * Gets tasks created from a specific template usage
 */
export async function getTasksFromTemplateUsage(usageId: string, firmId: string): Promise<Task[]> {
  const usage = await prisma.taskTemplateUsage.findUnique({
    where: { id: usageId },
    include: {
      case: true,
    },
  });

  if (!usage || usage.case.firmId !== firmId) {
    throw new Error('Template usage not found or access denied');
  }

  return prisma.task.findMany({
    where: {
      id: { in: usage.taskIds },
    },
    include: {
      assignee: true,
      predecessors: true,
      successors: true,
    },
    orderBy: {
      dueDate: 'asc',
    },
  });
}
