// Story 4.4: Dependency Automation Service
// Automatically activates successor tasks when prerequisites complete

import { prisma, Task, TaskStatus, NotificationType } from '@legal-platform/database';
import { getTasksUnblockedBy } from './task-dependency.service';

// ============================================================================
// Activation Result
// ============================================================================

export interface ActivationResult {
  activatedTasks: Task[];
  notificationsSent: number;
}

// ============================================================================
// Dependency Automation (AC: 2)
// ============================================================================

/**
 * Called when a task is completed to check for successor tasks that can now be activated
 */
export async function onTaskCompleted(
  taskId: string,
  firmId: string
): Promise<ActivationResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      case: true,
    },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  // Get all tasks that would be unblocked by this task
  const unblockedTasks = await getTasksUnblockedBy(taskId, firmId);

  const activatedTasks: Task[] = [];
  let notificationsSent = 0;

  for (const unblockedTask of unblockedTasks) {
    // Clear blocked reason
    const updatedTask = await prisma.task.update({
      where: { id: unblockedTask.id },
      data: {
        blockedReason: null,
      },
    });

    activatedTasks.push(updatedTask);

    // Send notification to assignee
    await prisma.notification.create({
      data: {
        userId: unblockedTask.assignedTo,
        type: NotificationType.DependencyUnblocked,
        title: 'Task Unblocked',
        message: `Task "${unblockedTask.title}" is now ready to start. Prerequisite "${task.title}" has been completed.`,
        link: `/cases/${task.caseId}?task=${unblockedTask.id}`,
        caseId: task.caseId,
      },
    });

    notificationsSent++;
  }

  return {
    activatedTasks,
    notificationsSent,
  };
}

/**
 * Handles different dependency types (FinishToStart, StartToStart, etc.)
 */
export async function handleDependencyActivation(
  taskId: string,
  eventType: 'started' | 'completed',
  firmId: string
): Promise<ActivationResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      successors: {
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
      },
    },
  });

  if (!task || task.firmId !== firmId) {
    throw new Error('Task not found or access denied');
  }

  const activatedTasks: Task[] = [];
  let notificationsSent = 0;

  for (const dependency of task.successors) {
    const successor = dependency.successor;
    let shouldActivate = false;

    switch (dependency.dependencyType) {
      case 'FinishToStart':
        // Activate successor when this task finishes
        if (eventType === 'completed') {
          shouldActivate = checkAllPredecessorsComplete(successor);
        }
        break;
      case 'StartToStart':
        // Activate successor when this task starts
        if (eventType === 'started') {
          shouldActivate = checkAllPredecessorsStarted(successor);
        }
        break;
      case 'FinishToFinish':
      case 'StartToFinish':
        // These are less common, handle based on event type
        if (eventType === 'completed') {
          shouldActivate = checkAllPredecessorsComplete(successor);
        }
        break;
    }

    if (shouldActivate && successor.blockedReason) {
      const updatedTask = await prisma.task.update({
        where: { id: successor.id },
        data: {
          blockedReason: null,
        },
      });

      activatedTasks.push(updatedTask);

      // Send notification
      await prisma.notification.create({
        data: {
          userId: successor.assignedTo,
          type: NotificationType.DependencyUnblocked,
          title: 'Task Unblocked',
          message: `Task "${successor.title}" is now ready to start.`,
          link: `/cases/${task.caseId}?task=${successor.id}`,
          caseId: task.caseId,
        },
      });

      notificationsSent++;
    }
  }

  return {
    activatedTasks,
    notificationsSent,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function checkAllPredecessorsComplete(task: Task & { predecessors: any[] }): boolean {
  return task.predecessors.every((dep) => dep.predecessor.status === TaskStatus.Completed);
}

function checkAllPredecessorsStarted(task: Task & { predecessors: any[] }): boolean {
  return task.predecessors.every(
    (dep) =>
      dep.predecessor.status === TaskStatus.InProgress ||
      dep.predecessor.status === TaskStatus.Completed
  );
}
