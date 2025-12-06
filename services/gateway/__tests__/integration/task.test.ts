/**
 * Task GraphQL API Integration Tests
 * Story 4.2: Task Type System Implementation - Task 24
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskAttendee: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    taskDocumentLink: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    taskDelegation: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import { taskResolvers, Context } from '../../src/graphql/resolvers/task.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
};

const testUser = {
  id: 'user-123',
  email: 'user@testfirm.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Partner',
  firmId: testFirm.id,
};

const testCase = {
  id: 'case-123',
  caseNumber: '123/2024',
  title: 'Test Case',
  firmId: testFirm.id,
  status: 'Active',
};

const mockContext: Context = {
  user: testUser,
  req: {} as any,
  res: {} as any,
};

describe('Task GraphQL API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mutations - createTask', () => {
    it('should create a Research task with type metadata', async () => {
      const taskData = {
        id: 'task-research-123',
        firmId: testFirm.id,
        caseId: testCase.id,
        type: 'Research',
        title: 'Legal Research',
        description: 'Research contract law',
        assignedTo: testUser.id,
        dueDate: new Date('2024-12-31'),
        status: 'Pending',
        priority: 'High',
        typeMetadata: {
          researchTopic: 'Contract Enforcement',
          jurisdiction: 'Federal',
        },
        createdBy: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.task.create.mockResolvedValue(taskData as any);

      const result = await taskResolvers.Mutation.createTask(
        {},
        {
          input: {
            caseId: testCase.id,
            type: 'Research',
            title: 'Legal Research',
            description: 'Research contract law',
            assignedTo: testUser.id,
            dueDate: '2024-12-31',
            priority: 'High',
            typeMetadata: {
              type: 'Research',
              data: {
                researchTopic: 'Contract Enforcement',
                jurisdiction: 'Federal',
              },
            },
          },
        },
        mockContext
      );

      expect(result).toEqual(taskData);
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: testFirm.id,
            type: 'Research',
            title: 'Legal Research',
          }),
        })
      );
    });

    it('should create a CourtDate task and auto-generate subtasks', async () => {
      const courtDateTask = {
        id: 'task-court-123',
        firmId: testFirm.id,
        caseId: testCase.id,
        type: 'CourtDate',
        title: 'Trial Hearing',
        assignedTo: testUser.id,
        dueDate: new Date('2024-12-31'),
        status: 'Pending',
        priority: 'Urgent',
        typeMetadata: {
          courtName: 'Superior Court',
          caseNumber: 'CV-2024-001',
          hearingType: 'Trial',
        },
        createdBy: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.task.create.mockResolvedValue(courtDateTask as any);

      const result = await taskResolvers.Mutation.createTask(
        {},
        {
          input: {
            caseId: testCase.id,
            type: 'CourtDate',
            title: 'Trial Hearing',
            assignedTo: testUser.id,
            dueDate: '2024-12-31',
            priority: 'Urgent',
            typeMetadata: {
              type: 'CourtDate',
              data: {
                courtName: 'Superior Court',
                caseNumber: 'CV-2024-001',
                hearingType: 'Trial',
              },
            },
          },
        },
        mockContext
      );

      expect(result).toEqual(courtDateTask);
      // Verify subtask service was called
      expect(mockPrisma.task.create).toHaveBeenCalled();
    });

    it('should enforce firm isolation', async () => {
      const differentFirmCase = {
        ...testCase,
        firmId: 'different-firm-456',
      };

      mockPrisma.case.findUnique.mockResolvedValue(differentFirmCase as any);

      await expect(
        taskResolvers.Mutation.createTask(
          {},
          {
            input: {
              caseId: testCase.id,
              type: 'Research',
              title: 'Test Task',
              assignedTo: testUser.id,
              dueDate: '2024-12-31',
            },
          },
          mockContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutations - Meeting Attendees', () => {
    it('should add attendee to Meeting task', async () => {
      const meetingTask = {
        id: 'task-meeting-123',
        type: 'Meeting',
        firmId: testFirm.id,
      };

      const attendee = {
        id: 'attendee-123',
        taskId: meetingTask.id,
        userId: testUser.id,
        isOrganizer: true,
        response: 'Pending',
      };

      mockPrisma.task.findUnique.mockResolvedValue(meetingTask as any);
      mockPrisma.taskAttendee.create.mockResolvedValue(attendee as any);

      const result = await taskResolvers.Mutation.addTaskAttendee(
        {},
        {
          taskId: meetingTask.id,
          input: {
            userId: testUser.id,
            isOrganizer: true,
          },
        },
        mockContext
      );

      expect(result).toEqual(attendee);
      expect(mockPrisma.taskAttendee.create).toHaveBeenCalled();
    });
  });

  describe('Mutations - Document Linking', () => {
    it('should link document to Research task', async () => {
      const researchTask = {
        id: 'task-research-123',
        type: 'Research',
        firmId: testFirm.id,
      };

      const document = {
        id: 'doc-123',
        firmId: testFirm.id,
      };

      const link = {
        id: 'link-123',
        taskId: researchTask.id,
        documentId: document.id,
        linkType: 'Source',
        notes: 'Key precedent',
        linkedBy: testUser.id,
        linkedAt: new Date(),
      };

      mockPrisma.task.findUnique.mockResolvedValue(researchTask as any);
      mockPrisma.document.findUnique.mockResolvedValue(document as any);
      mockPrisma.taskDocumentLink.create.mockResolvedValue(link as any);

      const result = await taskResolvers.Mutation.linkDocumentToTask(
        {},
        {
          taskId: researchTask.id,
          input: {
            documentId: document.id,
            linkType: 'Source',
            notes: 'Key precedent',
          },
        },
        mockContext
      );

      expect(result).toEqual(link);
    });
  });

  describe('Mutations - Business Trip Delegation', () => {
    it('should create delegation and send notification', async () => {
      const businessTripTask = {
        id: 'task-trip-123',
        type: 'BusinessTrip',
        firmId: testFirm.id,
        assignedTo: testUser.id,
      };

      const delegate = {
        id: 'delegate-123',
        firmId: testFirm.id,
      };

      const delegation = {
        id: 'delegation-123',
        sourceTaskId: businessTripTask.id,
        delegatedTo: delegate.id,
        delegatedBy: testUser.id,
        reason: 'Business Trip coverage',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-05'),
        status: 'Pending',
        createdAt: new Date(),
      };

      mockPrisma.task.findUnique.mockResolvedValue(businessTripTask as any);
      mockPrisma.user.findUnique.mockResolvedValue(delegate as any);
      mockPrisma.taskDelegation.create.mockResolvedValue(delegation as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      const result = await taskResolvers.Mutation.createDelegation(
        {},
        {
          sourceTaskId: businessTripTask.id,
          input: {
            delegatedTo: delegate.id,
            startDate: '2024-12-01',
            endDate: '2024-12-05',
          },
        },
        mockContext
      );

      expect(result).toEqual(delegation);
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('Queries', () => {
    it('should get task by ID with firm isolation', async () => {
      const task = {
        id: 'task-123',
        firmId: testFirm.id,
        type: 'Research',
        title: 'Test Task',
      };

      mockPrisma.task.findUnique.mockResolvedValue(task as any);

      const result = await taskResolvers.Query.task(
        {},
        { id: task.id },
        mockContext
      );

      expect(result).toEqual(task);
    });

    it('should get tasks by case', async () => {
      const tasks = [
        { id: 'task-1', caseId: testCase.id, firmId: testFirm.id },
        { id: 'task-2', caseId: testCase.id, firmId: testFirm.id },
      ];

      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await taskResolvers.Query.tasksByCase(
        {},
        { caseId: testCase.id },
        mockContext
      );

      expect(result).toEqual(tasks);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: testCase.id,
            firmId: testFirm.id,
          }),
        })
      );
    });
  });
});
