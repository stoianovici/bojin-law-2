// Story 4.4: Task Dependency Service
// Manages dependencies between tasks with cycle detection

import { prisma, Task, TaskDependency, TaskStatus, DependencyType } from '@legal-platform/database';

// Class wrapper for compatibility with resolvers
export class TaskDependencyService {
  addDependency = addDependency;
  removeDependency = removeDependency;
  getDependencies = getDependencies;
  validateNoCycle = validateNoCycle;
  getBlockedTasks = getBlockedTasks;
  getUnblockedTasks = getUnblockedTasks;
  isTaskBlocked = isTaskBlocked;
  getTasksUnblockedBy = getTasksUnblockedBy;
}

// ============================================================================
// Dependency Management (AC: 2, 3)
// ============================================================================

export async function addDependency(
  predecessorId: string,
  successorId: string,
  type: DependencyType,
  lagDays: number = 0,
  firmId: string
): Promise<TaskDependency> {
  // Verify both tasks exist and belong to same case in user's firm
  const [predecessor, successor] = await Promise.all([
    prisma.task.findUnique({ where: { id: predecessorId }, include: { case: true } }),
    prisma.task.findUnique({ where: { id: successorId }, include: { case: true } }),
  ]);

  if (!predecessor || !successor) {
    throw new Error('One or both tasks not found');
  }

  if (predecessor.firmId !== firmId || successor.firmId !== firmId) {
    throw new Error('Access denied');
  }

  if (predecessor.caseId !== successor.caseId) {
    throw new Error('Cannot create dependency between tasks in different cases');
  }

  if (predecessorId === successorId) {
    throw new Error('Cannot create dependency to self');
  }

  // Validate no cycle would be created
  const noCycleExists = await validateNoCycle(predecessorId, successorId);
  if (!noCycleExists) {
    throw new Error('Adding this dependency would create a circular dependency');
  }

  // Create dependency
  const dependency = await prisma.taskDependency.create({
    data: {
      predecessorId,
      successorId,
      dependencyType: type,
      lagDays,
    },
    include: {
      predecessor: true,
      successor: true,
    },
  });

  // Update successor task's blocked status if predecessor is not completed
  if (predecessor.status !== TaskStatus.Completed) {
    await prisma.task.update({
      where: { id: successorId },
      data: {
        blockedReason: `Waiting for "${predecessor.title}" to be completed`,
      },
    });
  }

  return dependency;
}

export async function removeDependency(
  dependencyId: string,
  firmId: string
): Promise<void> {
  // Verify dependency exists and belongs to user's firm
  const dependency = await prisma.taskDependency.findUnique({
    where: { id: dependencyId },
    include: {
      predecessor: true,
      successor: true,
    },
  });

  if (!dependency) {
    throw new Error('Dependency not found');
  }

  if (dependency.predecessor.firmId !== firmId) {
    throw new Error('Access denied');
  }

  // Remove dependency
  await prisma.taskDependency.delete({
    where: { id: dependencyId },
  });

  // Check if successor is still blocked by other dependencies
  const remainingPredecessors = await prisma.taskDependency.findMany({
    where: {
      successorId: dependency.successorId,
    },
    include: {
      predecessor: true,
    },
  });

  const hasIncompletePredecessors = remainingPredecessors.some(
    (dep) => dep.predecessor.status !== TaskStatus.Completed
  );

  if (!hasIncompletePredecessors) {
    // Clear blocked reason if no incomplete predecessors remain
    await prisma.task.update({
      where: { id: dependency.successorId },
      data: {
        blockedReason: null,
      },
    });
  }
}

export async function getDependencies(
  taskId: string,
  firmId: string
): Promise<{ predecessors: TaskDependency[]; successors: TaskDependency[] }> {
  // Verify task exists and belongs to user's firm
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  const [predecessors, successors] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { successorId: taskId },
      include: {
        predecessor: {
          include: {
            assignee: true,
          },
        },
      },
    }),
    prisma.taskDependency.findMany({
      where: { predecessorId: taskId },
      include: {
        successor: {
          include: {
            assignee: true,
          },
        },
      },
    }),
  ]);

  return { predecessors, successors };
}

/**
 * Validates that adding a dependency won't create a cycle using DFS
 * Returns true if no cycle, false if cycle would be created
 */
export async function validateNoCycle(
  predecessorId: string,
  successorId: string
): Promise<boolean> {
  // Build adjacency list of current dependencies
  const dependencies = await prisma.taskDependency.findMany();
  const graph = new Map<string, string[]>();

  for (const dep of dependencies) {
    if (!graph.has(dep.successorId)) {
      graph.set(dep.successorId, []);
    }
    graph.get(dep.successorId)!.push(dep.predecessorId);
  }

  // Add the proposed edge
  if (!graph.has(successorId)) {
    graph.set(successorId, []);
  }
  graph.get(successorId)!.push(predecessorId);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycleDFS(node)) {
        return false; // Cycle detected
      }
    }
  }

  return true; // No cycle
}

/**
 * Gets all blocked tasks for a case
 */
export async function getBlockedTasks(
  caseId: string,
  firmId: string
): Promise<Task[]> {
  // Verify case belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  // Get all tasks with incomplete predecessors
  const tasks = await prisma.task.findMany({
    where: {
      caseId,
      status: { not: TaskStatus.Completed },
    },
    include: {
      predecessors: {
        include: {
          predecessor: true,
        },
      },
      assignee: true,
    },
  });

  return tasks.filter((task) =>
    task.predecessors.some((dep) => dep.predecessor.status !== TaskStatus.Completed)
  );
}

/**
 * Gets all unblocked tasks for a case (ready to start)
 */
export async function getUnblockedTasks(
  caseId: string,
  firmId: string
): Promise<Task[]> {
  // Verify case belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  // Get all pending tasks
  const tasks = await prisma.task.findMany({
    where: {
      caseId,
      status: TaskStatus.Pending,
    },
    include: {
      predecessors: {
        include: {
          predecessor: true,
        },
      },
      assignee: true,
    },
  });

  // Filter tasks with all predecessors completed
  return tasks.filter(
    (task) =>
      task.predecessors.length === 0 ||
      task.predecessors.every((dep) => dep.predecessor.status === TaskStatus.Completed)
  );
}

/**
 * Checks if a task is blocked by incomplete predecessors
 */
export async function isTaskBlocked(taskId: string, firmId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      predecessors: {
        include: {
          predecessor: true,
        },
      },
    },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  return task.predecessors.some((dep) => dep.predecessor.status !== TaskStatus.Completed);
}

/**
 * Gets all tasks that would be unblocked if a specific task is completed
 */
export async function getTasksUnblockedBy(
  taskId: string,
  firmId: string
): Promise<Task[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  // Get all successor tasks
  const dependencies = await prisma.taskDependency.findMany({
    where: { predecessorId: taskId },
    include: {
      successor: {
        include: {
          predecessors: {
            include: {
              predecessor: true,
            },
          },
        },
      },
    },
  });

  // Filter successors that would be unblocked (only blocked by this task)
  return dependencies
    .map((dep) => dep.successor)
    .filter((successor) => {
      const incompletePredecessors = successor.predecessors.filter(
        (pred) => pred.predecessor.status !== TaskStatus.Completed && pred.predecessorId !== taskId
      );
      return incompletePredecessors.length === 0;
    });
}
