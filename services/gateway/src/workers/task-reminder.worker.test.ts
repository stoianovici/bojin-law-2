/**
 * Task Reminder Worker Unit Tests
 * Story 4.4: Task Dependencies and Automation - Task 35
 *
 * Tests for reminder scheduling logic, duplicate prevention, and overdue detection
 */

import { prisma, TaskStatus, NotificationType } from '@legal-platform/database';
import {
  startTaskReminderWorker,
  stopTaskReminderWorker,
  isTaskReminderWorkerRunning,
} from './task-reminder.worker';
import * as emailService from '../services/email.service';

// Use auto-mock from __mocks__/@legal-platform/database.ts
jest.mock('@legal-platform/database');

jest.mock('../services/email.service', () => ({
  sendTaskReminderEmail: jest.fn(),
  sendOverdueNotification: jest.fn(),
}));

// Cast prisma for TypeScript mock methods
const mockPrisma = prisma as unknown as {
  [K in keyof typeof prisma]: {
    [M in keyof (typeof prisma)[K]]: jest.Mock;
  };
};

// Mock timers for controlled testing
jest.useFakeTimers();

describe('TaskReminderWorker', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    process.env = { ...originalEnv };
    process.env.APP_URL = 'https://app.example.com';
    process.env.GRAPH_SERVICE_TOKEN = 'mock-token';

    // Ensure worker is stopped before each test
    if (isTaskReminderWorkerRunning()) {
      stopTaskReminderWorker();
    }
  });

  afterEach(() => {
    if (isTaskReminderWorkerRunning()) {
      stopTaskReminderWorker();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // Worker Lifecycle Tests
  // ============================================================================

  describe('Worker Lifecycle', () => {
    it('should start worker successfully', () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000); // 1 minute for testing

      expect(isTaskReminderWorkerRunning()).toBe(true);
    });

    it('should not start worker if already running', () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000);
      const firstStatus = isTaskReminderWorkerRunning();

      startTaskReminderWorker(60000); // Try to start again
      const secondStatus = isTaskReminderWorkerRunning();

      expect(firstStatus).toBe(true);
      expect(secondStatus).toBe(true);
    });

    it('should stop worker successfully', () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000);
      expect(isTaskReminderWorkerRunning()).toBe(true);

      stopTaskReminderWorker();
      expect(isTaskReminderWorkerRunning()).toBe(false);
    });

    it('should handle stop when worker is not running', () => {
      expect(isTaskReminderWorkerRunning()).toBe(false);

      // Should not throw
      expect(() => stopTaskReminderWorker()).not.toThrow();
    });

    it('should run immediately on start', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000);

      // Allow async processing to complete
      await jest.runAllTimersAsync();

      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });

    it('should run on interval', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000); // 1 minute interval

      // Initial call
      await jest.runAllTimersAsync();
      const initialCallCount = mockPrisma.task.findMany.mock.calls.length;

      // Advance time by 1 minute
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockPrisma.task.findMany.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ============================================================================
  // Reminder Processing Tests
  // ============================================================================

  describe('Reminder Processing', () => {
    it('should send reminders for tasks due in 1 day', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-1',
        title: 'Important Task',
        dueDate: tomorrow,
        status: TaskStatus.InProgress,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          id: 'user-1',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: {
          id: 'case-1',
          title: 'Case Title',
        },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);
      (emailService.sendTaskReminderEmail as jest.Mock).mockResolvedValue(true);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1],
      });

      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.TaskDeadlineReminder,
          title: 'Task Due in 1 Day',
          message: 'Task "Important Task" is due in 1 day.',
          link: '/cases/case-1?task=task-1',
          caseId: 'case-1',
        },
      });

      expect(emailService.sendTaskReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          taskTitle: 'Important Task',
          daysUntilDue: 1,
          isOverdue: false,
        }),
        'mock-token'
      );
    });

    it('should send reminders for multiple intervals', async () => {
      const task1Day = new Date();
      task1Day.setDate(task1Day.getDate() + 1);
      task1Day.setHours(0, 0, 0, 0);

      const task7Days = new Date();
      task7Days.setDate(task7Days.getDate() + 7);
      task7Days.setHours(0, 0, 0, 0);

      mockPrisma.task.findMany
        .mockResolvedValueOnce([
          {
            id: 'task-1',
            title: 'Task 1',
            dueDate: task1Day,
            status: TaskStatus.Pending,
            assignedTo: 'user-1',
            caseId: 'case-1',
            assignee: {
              email: 'user@example.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            case: { title: 'Case 1' },
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'task-2',
            title: 'Task 2',
            dueDate: task7Days,
            status: TaskStatus.Pending,
            assignedTo: 'user-2',
            caseId: 'case-2',
            assignee: {
              email: 'user2@example.com',
              firstName: 'Jane',
              lastName: 'Smith',
            },
            case: { title: 'Case 2' },
          },
        ] as any)
        .mockResolvedValue([]); // Overdue check

      mockPrisma.notification.create.mockResolvedValue({} as any);
      (emailService.sendTaskReminderEmail as jest.Mock).mockResolvedValue(true);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1, 7],
      });

      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(emailService.sendTaskReminderEmail).toHaveBeenCalledTimes(2);
    });

    it('should not send duplicate reminders', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-1',
        title: 'Task',
        dueDate: tomorrow,
        status: TaskStatus.Pending,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1],
      });

      // First run
      await jest.runAllTimersAsync();
      const firstCallCount = mockPrisma.notification.create.mock.calls.length;

      // Second run (should not send duplicate)
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create.mock.calls.length).toBe(firstCallCount);
    });

    it('should skip completed tasks', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1],
      });

      await jest.runAllTimersAsync();

      // Should query with status not Completed
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: TaskStatus.Completed },
          }),
        })
      );

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should skip weekends when excludeWeekends is true', async () => {
      // Find next Saturday
      const saturday = new Date();
      while (saturday.getDay() !== 6) {
        saturday.setDate(saturday.getDate() + 1);
      }
      saturday.setHours(0, 0, 0, 0);

      // Calculate days until Saturday
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysUntil = Math.floor((saturday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const mockTask = {
        id: 'task-weekend',
        title: 'Weekend Task',
        dueDate: saturday,
        status: TaskStatus.Pending,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000, {
        reminderIntervals: [daysUntil],
        excludeWeekends: true,
      });

      await jest.runAllTimersAsync();

      // Should not create notification for weekend
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should not skip email when GRAPH_SERVICE_TOKEN is missing', async () => {
      delete process.env.GRAPH_SERVICE_TOKEN;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-1',
        title: 'Task',
        dueDate: tomorrow,
        status: TaskStatus.Pending,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1],
        enableEmailReminders: true,
      });

      await jest.runAllTimersAsync();

      // Should still create in-app notification
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      // Should not call email service without token
      expect(emailService.sendTaskReminderEmail).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Overdue Task Tests
  // ============================================================================

  describe('Overdue Task Processing', () => {
    it('should send overdue notifications', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      yesterday.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-overdue',
        title: 'Overdue Task',
        dueDate: yesterday,
        status: TaskStatus.InProgress,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: {
          title: 'Case Title',
        },
      };

      mockPrisma.task.findMany
        .mockResolvedValueOnce([]) // No upcoming reminders
        .mockResolvedValueOnce([]) // No upcoming reminders
        .mockResolvedValueOnce([]) // No upcoming reminders
        .mockResolvedValue([mockTask] as any); // Overdue

      mockPrisma.notification.create.mockResolvedValue({} as any);
      (emailService.sendOverdueNotification as jest.Mock).mockResolvedValue(true);

      startTaskReminderWorker(60000);

      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.TaskOverdue,
          title: 'Task Overdue',
          message: expect.stringContaining('overdue'),
          link: '/cases/case-1?task=task-overdue',
          caseId: 'case-1',
        },
      });

      expect(emailService.sendOverdueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          taskTitle: 'Overdue Task',
          isOverdue: true,
        }),
        'mock-token'
      );
    });

    it('should not send duplicate overdue reminders', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      yesterday.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-overdue',
        title: 'Overdue Task',
        dueDate: yesterday,
        status: TaskStatus.InProgress,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000);

      // First run
      await jest.runAllTimersAsync();
      const firstCallCount = mockPrisma.notification.create.mock.calls.length;

      // Second run (should not send duplicate for same day count)
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create.mock.calls.length).toBe(firstCallCount);
    });

    it('should calculate correct days overdue', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-overdue',
        title: 'Overdue Task',
        dueDate: threeDaysAgo,
        status: TaskStatus.InProgress,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000);

      await jest.runAllTimersAsync();

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringMatching(/3 days overdue/),
          }),
        })
      );
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should use custom reminder intervals', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      startTaskReminderWorker(60000, {
        reminderIntervals: [2, 5],
      });

      await jest.runAllTimersAsync();

      // Should query for 2 days and 5 days
      expect(mockPrisma.task.findMany.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should disable email reminders when configured', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const mockTask = {
        id: 'task-1',
        title: 'Task',
        dueDate: tomorrow,
        status: TaskStatus.Pending,
        assignedTo: 'user-1',
        caseId: 'case-1',
        assignee: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        case: { title: 'Case' },
      };

      mockPrisma.task.findMany.mockResolvedValue([mockTask] as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      startTaskReminderWorker(60000, {
        reminderIntervals: [1],
        enableEmailReminders: false,
      });

      await jest.runAllTimersAsync();

      // Should create in-app notification
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      // Should not send email
      expect(emailService.sendTaskReminderEmail).not.toHaveBeenCalled();
    });
  });
});
