// @ts-nocheck
// Story 4.4: Parallel Task Service
// Identifies parallel tasks and suggests assignees

import { prisma, Task, TaskStatus, User } from '@legal-platform/database';
import { ParallelTaskGroup, AssigneeSuggestion } from '@legal-platform/types';

// Class wrapper for compatibility with resolvers
export class ParallelTaskService {
  identifyParallelTasks = identifyParallelTasks;
  suggestAssignees = suggestAssignees;
  getParallelTasksWithSuggestions = getParallelTasksWithSuggestions;
}

// ============================================================================
// Parallel Task Identification (AC: 4)
// ============================================================================

export async function identifyParallelTasks(
  caseId: string,
  firmId: string
): Promise<ParallelTaskGroup[]> {
  // Verify case belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  // Get all pending/in-progress tasks with dependencies
  const tasks = await prisma.task.findMany({
    where: {
      caseId,
      status: { in: [TaskStatus.Pending, TaskStatus.InProgress] },
    },
    include: {
      predecessors: {
        include: {
          predecessor: true,
        },
      },
      successors: true,
      assignee: true,
    },
  });

  if (tasks.length === 0) {
    return [];
  }

  // Build groups of tasks that can run in parallel
  const groups: ParallelTaskGroup[] = [];
  const processed = new Set<string>();

  for (const task of tasks) {
    if (processed.has(task.id)) continue;

    // Check if task is unblocked (all predecessors complete)
    const isUnblocked = task.predecessors.every(
      (dep) => dep.predecessor.status === TaskStatus.Completed
    );

    if (!isUnblocked) continue;

    // Find other tasks at the same "level" (unblocked, no interdependencies)
    const parallelTasks = tasks.filter((t) => {
      if (processed.has(t.id) || t.id === task.id) return false;

      // Must also be unblocked
      const tUnblocked = t.predecessors.every(
        (dep) => dep.predecessor.status === TaskStatus.Completed
      );
      if (!tUnblocked) return false;

      // Check for interdependencies
      const hasInterdependency =
        task.predecessors.some((dep) => dep.predecessorId === t.id) ||
        task.successors.some((dep) => dep.successorId === t.id) ||
        t.predecessors.some((dep) => dep.predecessorId === task.id) ||
        t.successors.some((dep) => dep.successorId === task.id);

      return !hasInterdependency;
    });

    if (parallelTasks.length > 0) {
      const groupTasks = [task, ...parallelTasks];
      groupTasks.forEach((t) => processed.add(t.id));

      groups.push({
        groupId: `group-${task.id}`,
        tasks: groupTasks,
        canRunSimultaneously: true,
        suggestedAssignees: [], // Will be populated by suggestAssignees
      });
    }
  }

  return groups;
}

/**
 * Suggests assignees for a list of tasks based on workload, skills, and availability
 * (Story 4.5: Full integration with skill-based assignment)
 */
export async function suggestAssignees(
  taskIds: string[],
  firmId: string
): Promise<AssigneeSuggestion[]> {
  // Import skill assignment service for enhanced suggestions
  const { skillAssignmentService } = await import('./skill-assignment.service');
  const { workloadService } = await import('./workload.service');

  // Get all users in the firm
  const users = await prisma.user.findMany({
    where: {
      firmId,
      status: 'Active',
    },
  });

  // Get tasks to analyze
  const tasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
    },
    include: {
      case: {
        select: { id: true },
      },
    },
  });

  if (tasks.length === 0) return [];

  // Use the first task for skill matching (all tasks in parallel group typically have similar requirements)
  const primaryTask = tasks[0];

  // Get suggestions using skill-based assignment service
  const suggestionResponse = await skillAssignmentService.suggestAssignees(
    {
      taskType: primaryTask.type,
      taskTitle: primaryTask.title,
      caseId: primaryTask.caseId,
      estimatedHours: primaryTask.estimatedHours ? Number(primaryTask.estimatedHours) : 2,
      dueDate: primaryTask.dueDate,
    },
    firmId
  );

  // Map to AssigneeSuggestion format
  const suggestions: AssigneeSuggestion[] = suggestionResponse.suggestions.map(
    (s: {
      userId: string;
      user: { firstName: string; lastName: string };
      matchScore: number;
      currentWorkload: number;
      availableCapacity: number;
      reasoning: string;
    }) => ({
      userId: s.userId,
      userName: `${s.user.firstName} ${s.user.lastName}`,
      matchScore: s.matchScore,
      currentWorkload: s.currentWorkload,
      availableCapacity: s.availableCapacity,
      reasoning: s.reasoning,
    })
  );

  return suggestions;
}

/**
 * Gets parallel task groups with assignee suggestions
 */
export async function getParallelTasksWithSuggestions(
  caseId: string,
  firmId: string
): Promise<ParallelTaskGroup[]> {
  const groups = await identifyParallelTasks(caseId, firmId);

  // Add assignee suggestions to each group
  for (const group of groups) {
    const taskIds = group.tasks.map((t: Task) => t.id);
    group.suggestedAssignees = await suggestAssignees(taskIds, firmId);
  }

  return groups;
}
