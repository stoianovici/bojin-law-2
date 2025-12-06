// Story 4.4: Critical Path Service
// Calculates critical path using longest path algorithm

import { prisma, Task, TaskStatus } from '@legal-platform/database';
import { CriticalPathResult, BottleneckInfo } from '@legal-platform/types';

// Class wrapper for compatibility with resolvers
export class CriticalPathService {
  calculateCriticalPath = calculateCriticalPath;
  recalculateCriticalPath = recalculateCriticalPath;
  getBottlenecks = getBottlenecks;
}

// ============================================================================
// Critical Path Calculation (AC: 5)
// ============================================================================

export async function calculateCriticalPath(
  caseId: string,
  firmId: string
): Promise<CriticalPathResult> {
  // Verify case belongs to firm
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.firmId !== firmId) {
    throw new Error('Case not found or access denied');
  }

  // Get all tasks with dependencies
  const tasks = await prisma.task.findMany({
    where: { caseId },
    include: {
      predecessors: true,
      successors: true,
    },
  });

  if (tasks.length === 0) {
    return {
      caseId,
      criticalTasks: [],
      totalDuration: 0,
      estimatedCompletionDate: new Date(),
      bottlenecks: [],
    };
  }

  // Calculate early start/finish and late start/finish for each task
  const taskMetrics = new Map<
    string,
    {
      earlyStart: number;
      earlyFinish: number;
      lateStart: number;
      lateFinish: number;
      slack: number;
      duration: number;
    }
  >();

  // Build graph
  const graph = new Map<string, string[]>();
  const reverseGraph = new Map<string, string[]>();

  for (const task of tasks) {
    graph.set(
      task.id,
      task.successors.map((s) => s.successorId)
    );
    reverseGraph.set(
      task.id,
      task.predecessors.map((p) => p.predecessorId)
    );

    // Calculate task duration in days
    const duration = task.estimatedHours ? Math.ceil(Number(task.estimatedHours) / 8) : 1;
    taskMetrics.set(task.id, {
      earlyStart: 0,
      earlyFinish: 0,
      lateStart: 0,
      lateFinish: 0,
      slack: 0,
      duration,
    });
  }

  // Forward pass: Calculate Early Start and Early Finish
  const topoOrder = topologicalSort(tasks, graph);

  for (const taskId of topoOrder) {
    const task = tasks.find((t) => t.id === taskId)!;
    const metrics = taskMetrics.get(taskId)!;

    // Early start is max of predecessor early finishes
    const predecessorIds = reverseGraph.get(taskId) || [];
    if (predecessorIds.length === 0) {
      metrics.earlyStart = 0;
    } else {
      metrics.earlyStart = Math.max(
        ...predecessorIds.map((predId) => {
          const predMetrics = taskMetrics.get(predId)!;
          const dependency = task.predecessors.find((p) => p.predecessorId === predId)!;
          return predMetrics.earlyFinish + dependency.lagDays;
        })
      );
    }

    metrics.earlyFinish = metrics.earlyStart + metrics.duration;
  }

  // Find project duration (max early finish)
  const maxEarlyFinish = Math.max(...Array.from(taskMetrics.values()).map((m) => m.earlyFinish));

  // Backward pass: Calculate Late Start and Late Finish
  const reverseTopoOrder = [...topoOrder].reverse();

  for (const taskId of reverseTopoOrder) {
    const task = tasks.find((t) => t.id === taskId)!;
    const metrics = taskMetrics.get(taskId)!;

    // Late finish is min of successor late starts
    const successorIds = graph.get(taskId) || [];
    if (successorIds.length === 0) {
      metrics.lateFinish = maxEarlyFinish;
    } else {
      metrics.lateFinish = Math.min(
        ...successorIds.map((succId) => {
          const succMetrics = taskMetrics.get(succId)!;
          const dependency = task.successors.find((s) => s.successorId === succId)!;
          return succMetrics.lateStart - dependency.lagDays;
        })
      );
    }

    metrics.lateStart = metrics.lateFinish - metrics.duration;
    metrics.slack = metrics.lateStart - metrics.earlyStart;
  }

  // Critical tasks have zero slack
  const criticalTaskIds = Array.from(taskMetrics.entries())
    .filter(([_, metrics]) => metrics.slack === 0)
    .map(([taskId, _]) => taskId);

  const criticalTasks = tasks.filter((t) => criticalTaskIds.includes(t.id));

  // Calculate estimated completion date
  const earliestTask = tasks.reduce((earliest, task) =>
    task.dueDate < earliest.dueDate ? task : earliest
  );
  const estimatedCompletionDate = new Date(earliestTask.dueDate);
  estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + maxEarlyFinish);

  // Identify bottlenecks (critical tasks with many dependents)
  const bottlenecks: BottleneckInfo[] = criticalTasks
    .map((task) => {
      const metrics = taskMetrics.get(task.id)!;
      return {
        taskId: task.id,
        taskTitle: task.title,
        dependentCount: task.successors.length,
        slackDays: metrics.slack,
      };
    })
    .filter((b) => b.dependentCount > 0)
    .sort((a, b) => b.dependentCount - a.dependentCount)
    .slice(0, 5); // Top 5 bottlenecks

  return {
    caseId,
    criticalTasks,
    totalDuration: maxEarlyFinish,
    estimatedCompletionDate,
    bottlenecks,
  };
}

/**
 * Updates the isCriticalPath flag for all tasks in a case
 */
export async function recalculateCriticalPath(
  caseId: string,
  firmId: string
): Promise<void> {
  const result = await calculateCriticalPath(caseId, firmId);

  // Update all tasks: set critical path flag
  await prisma.$transaction([
    // Clear all critical path flags for case
    prisma.task.updateMany({
      where: { caseId },
      data: { isCriticalPath: false },
    }),
    // Set critical path flag for critical tasks
    prisma.task.updateMany({
      where: {
        id: { in: result.criticalTasks.map((t: Task) => t.id) },
      },
      data: { isCriticalPath: true },
    }),
  ]);
}

/**
 * Gets bottlenecks for a case
 */
export async function getBottlenecks(
  caseId: string,
  firmId: string
): Promise<BottleneckInfo[]> {
  const result = await calculateCriticalPath(caseId, firmId);
  return result.bottlenecks;
}

// ============================================================================
// Helper Functions
// ============================================================================

function topologicalSort(tasks: Task[], graph: Map<string, string[]>): string[] {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  // Initialize in-degrees
  for (const task of tasks) {
    inDegree.set(task.id, 0);
  }

  for (const [_, successors] of graph.entries()) {
    for (const successor of successors) {
      inDegree.set(successor, (inDegree.get(successor) || 0) + 1);
    }
  }

  // Find all nodes with in-degree 0
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const taskId = queue.shift()!;
    result.push(taskId);

    const successors = graph.get(taskId) || [];
    for (const successor of successors) {
      const newDegree = inDegree.get(successor)! - 1;
      inDegree.set(successor, newDegree);
      if (newDegree === 0) {
        queue.push(successor);
      }
    }
  }

  return result;
}
