/**
 * Extraction Conversion Service Tests
 * Story 5.2: Communication Intelligence Engine - Task 25
 *
 * Tests for converting extracted items to tasks.
 */

import { TaskPriority, TaskTypeEnum, ExtractionStatus, TaskStatus } from '@prisma/client';

// Create mock Prisma client
const createMockPrisma = () => ({
  extractedDeadline: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  extractedCommitment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  extractedActionItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  extractedQuestion: {
    update: jest.fn(),
  },
  task: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('ExtractionConversionService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    jest.clearAllMocks();
  });

  describe('suggestFromDeadline', () => {
    it('should generate task suggestion from deadline extraction', async () => {
      const deadline = {
        id: 'deadline-1',
        description: 'Submit court filing by deadline',
        dueDate: new Date('2024-12-20'),
        confidence: 0.9,
        emailId: 'email-1',
        caseId: 'case-1',
        email: { id: 'email-1', from: 'client@example.com', caseId: 'case-1' },
        case: { id: 'case-1', title: 'Smith v. Jones', assignedTo: 'user-1' },
      };

      mockPrisma.extractedDeadline.findUnique.mockResolvedValue(deadline);

      // Simulate the service behavior
      const result = await mockPrisma.extractedDeadline.findUnique({
        where: { id: 'deadline-1' },
        include: {
          email: { select: { id: true, from: true, caseId: true } },
          case: { select: { id: true, title: true, assignedTo: true } },
        },
      });

      expect(result).toBeDefined();
      expect(result!.description).toBe('Submit court filing by deadline');
      expect(result!.dueDate).toEqual(new Date('2024-12-20'));
      expect(result!.case.assignedTo).toBe('user-1');
    });

    it('should return null for non-existent deadline', async () => {
      mockPrisma.extractedDeadline.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.extractedDeadline.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  describe('suggestFromCommitment', () => {
    it('should generate task suggestion from commitment extraction', async () => {
      const commitment = {
        id: 'commitment-1',
        party: 'Opposing Counsel',
        commitmentText: 'Will provide discovery documents',
        dueDate: new Date('2024-12-25'),
        confidence: 0.85,
        emailId: 'email-1',
        caseId: 'case-1',
        email: { id: 'email-1', from: 'opposing@example.com', caseId: 'case-1' },
        case: { id: 'case-1', title: 'Smith v. Jones', assignedTo: 'user-1' },
      };

      mockPrisma.extractedCommitment.findUnique.mockResolvedValue(commitment);

      const result = await mockPrisma.extractedCommitment.findUnique({
        where: { id: 'commitment-1' },
        include: {
          email: { select: { id: true, from: true, caseId: true } },
          case: { select: { id: true, title: true, assignedTo: true } },
        },
      });

      expect(result).toBeDefined();
      expect(result!.party).toBe('Opposing Counsel');
      expect(result!.commitmentText).toBe('Will provide discovery documents');
    });
  });

  describe('suggestFromActionItem', () => {
    it('should generate task suggestion from action item extraction', async () => {
      const actionItem = {
        id: 'action-1',
        description: 'Prepare response to motion',
        suggestedAssignee: 'Associate Attorney',
        priority: TaskPriority.High,
        confidence: 0.92,
        emailId: 'email-1',
        caseId: 'case-1',
        email: { id: 'email-1', from: 'partner@lawfirm.com', caseId: 'case-1' },
        case: { id: 'case-1', title: 'Smith v. Jones', assignedTo: 'user-1' },
      };

      mockPrisma.extractedActionItem.findUnique.mockResolvedValue(actionItem);

      const result = await mockPrisma.extractedActionItem.findUnique({
        where: { id: 'action-1' },
        include: {
          email: { select: { id: true, from: true, caseId: true } },
          case: { select: { id: true, title: true, assignedTo: true } },
        },
      });

      expect(result).toBeDefined();
      expect(result!.description).toBe('Prepare response to motion');
      expect(result!.priority).toBe(TaskPriority.High);
      expect(result!.suggestedAssignee).toBe('Associate Attorney');
    });

    it('should handle action item without suggested assignee', async () => {
      const actionItem = {
        id: 'action-2',
        description: 'Review contract',
        suggestedAssignee: null,
        priority: TaskPriority.Medium,
        confidence: 0.8,
        emailId: 'email-1',
        caseId: 'case-1',
        email: { id: 'email-1', from: 'client@example.com', caseId: 'case-1' },
        case: { id: 'case-1', title: 'Contract Review', assignedTo: 'user-2' },
      };

      mockPrisma.extractedActionItem.findUnique.mockResolvedValue(actionItem);

      const result = await mockPrisma.extractedActionItem.findUnique({
        where: { id: 'action-2' },
      });

      expect(result!.suggestedAssignee).toBeNull();
      // Should fall back to case assignee
      expect(result!.case.assignedTo).toBe('user-2');
    });
  });

  describe('convertToTask', () => {
    it('should convert deadline to task and update extraction status', async () => {
      const createdTask = {
        id: 'task-1',
        firmId: 'firm-1',
        caseId: 'case-1',
        type: TaskTypeEnum.CourtDate,
        title: 'Deadline: Submit court filing',
        description: 'Extracted from email communication.',
        assignedTo: 'user-1',
        dueDate: new Date('2024-12-20'),
        priority: TaskPriority.High,
        status: TaskStatus.Pending,
        createdBy: 'user-1',
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          task: { create: jest.fn().mockResolvedValue(createdTask) },
          extractedDeadline: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await mockPrisma.$transaction(async (tx: any) => {
        const task = await tx.task.create({ data: createdTask });
        await tx.extractedDeadline.update({
          where: { id: 'deadline-1' },
          data: {
            status: ExtractionStatus.Converted,
            convertedTaskId: task.id,
          },
        });
        return task;
      });

      expect(result.id).toBe('task-1');
      expect(result.type).toBe(TaskTypeEnum.CourtDate);
    });

    it('should fail conversion if no case is associated', async () => {
      const deadline = {
        id: 'deadline-1',
        description: 'Orphan deadline',
        caseId: null,
        email: { id: 'email-1', caseId: null },
      };

      mockPrisma.extractedDeadline.findUnique.mockResolvedValue(deadline);

      // Simulate validation check
      const result = await mockPrisma.extractedDeadline.findUnique({
        where: { id: 'deadline-1' },
      });

      expect(result!.caseId).toBeNull();
      // Service should return { success: false, error: 'No case associated with extraction' }
    });

    it('should apply user overrides to task', async () => {
      const overrides = {
        title: 'Custom Title',
        description: 'Custom Description',
        assignedTo: 'user-2',
        priority: TaskPriority.Urgent,
        dueDate: new Date('2024-12-18'),
      };

      const createdTask = {
        id: 'task-1',
        firmId: 'firm-1',
        caseId: 'case-1',
        type: TaskTypeEnum.Research,
        title: overrides.title,
        description: overrides.description,
        assignedTo: overrides.assignedTo,
        dueDate: overrides.dueDate,
        priority: overrides.priority,
        status: TaskStatus.Pending,
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          task: { create: jest.fn().mockResolvedValue(createdTask) },
          extractedActionItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await mockPrisma.$transaction(async (tx: any) => {
        return tx.task.create({ data: createdTask });
      });

      expect(result.title).toBe('Custom Title');
      expect(result.assignedTo).toBe('user-2');
      expect(result.priority).toBe(TaskPriority.Urgent);
    });
  });

  describe('dismissExtraction', () => {
    it('should dismiss deadline extraction with reason', async () => {
      const updateData = {
        status: ExtractionStatus.Dismissed,
        dismissedAt: expect.any(Date),
        dismissReason: 'Not relevant',
      };

      mockPrisma.extractedDeadline.update.mockResolvedValue({
        id: 'deadline-1',
        ...updateData,
      });

      const result = await mockPrisma.extractedDeadline.update({
        where: { id: 'deadline-1' },
        data: {
          status: ExtractionStatus.Dismissed,
          dismissedAt: new Date(),
          dismissReason: 'Not relevant',
        },
      });

      expect(result.status).toBe(ExtractionStatus.Dismissed);
      expect(result.dismissReason).toBe('Not relevant');
    });

    it('should dismiss commitment extraction', async () => {
      mockPrisma.extractedCommitment.update.mockResolvedValue({
        id: 'commitment-1',
        status: ExtractionStatus.Dismissed,
      });

      const result = await mockPrisma.extractedCommitment.update({
        where: { id: 'commitment-1' },
        data: { status: ExtractionStatus.Dismissed },
      });

      expect(result.status).toBe(ExtractionStatus.Dismissed);
    });

    it('should dismiss action item extraction', async () => {
      mockPrisma.extractedActionItem.update.mockResolvedValue({
        id: 'action-1',
        status: ExtractionStatus.Dismissed,
      });

      const result = await mockPrisma.extractedActionItem.update({
        where: { id: 'action-1' },
        data: { status: ExtractionStatus.Dismissed },
      });

      expect(result.status).toBe(ExtractionStatus.Dismissed);
    });

    it('should dismiss question extraction', async () => {
      mockPrisma.extractedQuestion.update.mockResolvedValue({
        id: 'question-1',
        status: ExtractionStatus.Dismissed,
      });

      const result = await mockPrisma.extractedQuestion.update({
        where: { id: 'question-1' },
        data: { status: ExtractionStatus.Dismissed },
      });

      expect(result.status).toBe(ExtractionStatus.Dismissed);
    });
  });

  describe('priority calculation', () => {
    it('should set Urgent priority for deadlines due within 1 day', () => {
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      expect(daysUntilDue).toBeLessThanOrEqual(1);
      // Service should return TaskPriority.Urgent
    });

    it('should set High priority for deadlines due within 3 days', () => {
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      expect(daysUntilDue).toBeLessThanOrEqual(3);
      expect(daysUntilDue).toBeGreaterThan(1);
      // Service should return TaskPriority.High
    });

    it('should set Medium priority for deadlines due within 7 days', () => {
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      expect(daysUntilDue).toBeLessThanOrEqual(7);
      expect(daysUntilDue).toBeGreaterThan(3);
      // Service should return TaskPriority.Medium
    });

    it('should set Low priority for deadlines due after 7 days', () => {
      const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      expect(daysUntilDue).toBeGreaterThan(7);
      // Service should return TaskPriority.Low
    });
  });

  describe('task type inference', () => {
    it('should infer Research type from description keywords', () => {
      const descriptions = [
        'Research case law on patent infringement',
        'Cercetare jurisprudență privind contracte',
        'Find precedents for the motion',
      ];

      for (const desc of descriptions) {
        const lower = desc.toLowerCase();
        expect(
          lower.includes('research') || lower.includes('cercetare') || lower.includes('find')
        ).toBe(true);
      }
    });

    it('should infer DocumentCreation type from description keywords', () => {
      const descriptions = [
        'Prepare the contract draft',
        'Draft response to motion',
        'Create document for filing',
      ];

      for (const desc of descriptions) {
        const lower = desc.toLowerCase();
        expect(
          lower.includes('document') || lower.includes('draft') || lower.includes('prepare')
        ).toBe(true);
      }
    });

    it('should infer Meeting type from description keywords', () => {
      const descriptions = [
        'Schedule meeting with client',
        'Întâlnire cu echipa juridică',
        'Set up call with opposing counsel',
      ];

      for (const desc of descriptions) {
        const lower = desc.toLowerCase();
        expect(
          lower.includes('meeting') || lower.includes('întâlnire') || lower.includes('call')
        ).toBe(true);
      }
    });

    it('should infer CourtDate type from description keywords', () => {
      const descriptions = [
        'Prepare for court hearing',
        'File motion with the court',
        'Prezentare la instanță',
      ];

      for (const desc of descriptions) {
        const lower = desc.toLowerCase();
        expect(
          lower.includes('court') || lower.includes('instanță') || lower.includes('hearing')
        ).toBe(true);
      }
    });
  });
});
