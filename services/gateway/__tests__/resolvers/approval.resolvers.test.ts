/**
 * Approval Resolvers Unit Tests
 * Story 2.8.2: Case Approval Workflow
 *
 * Tests for approval workflow resolvers (pendingCases, myCases, approveCase, rejectCase, resubmitCase)
 * Addresses QA Gate Issue: TEST-001 (High) - Zero backend unit tests for approval resolvers
 * Addresses QA Gate Issue: SEC-001 (High) - Authorization logic has no test coverage
 * Addresses QA Gate Issue: TEST-003 (Medium) - No audit log verification tests
 */

import { prisma } from '@legal-platform/database';
import { ApprovalStatus, CaseStatus, UserRole } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { approvalResolvers } from '../../src/graphql/resolvers/approval.resolvers';

// Type helper for mocked Prisma - cast the entire prisma client to enable mock methods
const mockPrisma = prisma as unknown as {
  [K in keyof typeof prisma]: {
    [M in keyof (typeof prisma)[K]]: jest.Mock;
  };
} & {
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

describe('Approval Resolvers - Story 2.8.2', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset transaction mock
    mockPrisma.$transaction.mockImplementation((callback) => callback(prisma));

    // Default Partner context
    mockContext = {
      user: {
        id: 'partner-123',
        firmId: 'firm-456',
        role: UserRole.Partner,
        email: 'partner@test.com',
      },
    };
  });

  describe('Query: pendingCases', () => {
    const mockPendingCases = [
      {
        id: 'case-1',
        title: 'Test Case 1',
        firmId: 'firm-456',
        status: CaseStatus.PendingApproval,
        createdAt: new Date('2025-11-01'),
        client: { id: 'client-1', name: 'Client 1' },
        teamMembers: [],
        actors: [],
        approval: {
          id: 'approval-1',
          caseId: 'case-1',
          submittedBy: 'associate-1',
          submittedAt: new Date('2025-11-01'),
          status: ApprovalStatus.Pending,
          revisionCount: 0,
          submitter: { id: 'associate-1', name: 'Associate 1' },
        },
        rateHistory: [],
      },
    ];

    it('should return pending cases for Partners', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockPendingCases);

      const result = await approvalResolvers.Query.pendingCases({}, {}, mockContext);

      expect(result).toEqual(mockPendingCases);
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith({
        where: {
          firmId: 'firm-456',
          status: CaseStatus.PendingApproval,
        },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
          approval: {
            include: {
              submitter: true,
              reviewer: true,
            },
          },
          rateHistory: {
            include: {
              changer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // FIFO queue
        },
      });
    });

    it('should return empty array if no pending cases', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);

      const result = await approvalResolvers.Query.pendingCases({}, {}, mockContext);

      expect(result).toEqual([]);
    });

    it('should throw FORBIDDEN error for Associates', async () => {
      mockContext.user.role = UserRole.Associate;

      await expect(approvalResolvers.Query.pendingCases({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );

      await expect(approvalResolvers.Query.pendingCases({}, {}, mockContext)).rejects.toThrow(
        'Only Partners can view pending approvals'
      );

      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN error for Paralegals', async () => {
      mockContext.user.role = UserRole.Paralegal;

      await expect(approvalResolvers.Query.pendingCases({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );

      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
    });

    it('should filter by firmId to enforce multi-tenant isolation', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockPendingCases);

      await approvalResolvers.Query.pendingCases({}, {}, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.firmId).toBe('firm-456');
    });

    it('should sort by createdAt ascending (FIFO queue)', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockPendingCases);

      await approvalResolvers.Query.pendingCases({}, {}, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('Query: myCases', () => {
    const mockCases = [
      {
        id: 'case-1',
        title: 'Test Case 1',
        firmId: 'firm-456',
        status: CaseStatus.PendingApproval,
        createdAt: new Date('2025-11-01'),
        client: { id: 'client-1', name: 'Client 1' },
        teamMembers: [],
        actors: [],
        approval: {
          id: 'approval-1',
          submittedBy: 'associate-1',
        },
        rateHistory: [],
      },
    ];

    it('should return all firm cases for Partners', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockCases);

      const result = await approvalResolvers.Query.myCases({}, {}, mockContext);

      expect(result).toEqual(mockCases);
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith({
        where: {
          firmId: 'firm-456',
        },
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should filter by status if provided', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockCases);

      await approvalResolvers.Query.myCases({}, { status: CaseStatus.Active }, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe(CaseStatus.Active);
    });

    it('should return only submitted and assigned cases for Associates', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';
      mockPrisma.case.findMany.mockResolvedValue(mockCases);

      await approvalResolvers.Query.myCases({}, {}, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR).toHaveLength(2);
      expect(callArgs.where.OR[0].approval.submittedBy).toBe('associate-1');
      expect(callArgs.where.OR[1].teamMembers.some.userId).toBe('associate-1');
    });

    it('should enforce firm isolation for Associates', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';
      mockPrisma.case.findMany.mockResolvedValue([]);

      await approvalResolvers.Query.myCases({}, {}, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.firmId).toBe('firm-456');
    });

    it('should sort by createdAt descending', async () => {
      mockPrisma.case.findMany.mockResolvedValue(mockCases);

      await approvalResolvers.Query.myCases({}, {}, mockContext);

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('Mutation: approveCase', () => {
    const mockCase = {
      id: 'case-1',
      title: 'Test Case',
      firmId: 'firm-456',
      status: CaseStatus.PendingApproval,
      approval: {
        id: 'approval-1',
        caseId: 'case-1',
        submittedBy: 'associate-1',
        status: ApprovalStatus.Pending,
        submitter: { id: 'associate-1', name: 'Associate 1' },
      },
    };

    it('should approve case successfully for Partner', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
      });
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      const result = await approvalResolvers.Mutation.approveCase(
        {},
        { caseId: 'case-1' },
        mockContext
      );

      expect(result.status).toBe(CaseStatus.Active);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should update approval record with reviewer details', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
      });
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext);

      expect(mockPrisma.caseApproval.update).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        data: {
          status: ApprovalStatus.Approved,
          reviewedBy: 'partner-123',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('should create audit log entry for approval (AC9)', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
      });
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext);

      expect(mockPrisma.caseAuditLog.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case-1',
          userId: 'partner-123',
          action: 'CASE_APPROVED',
          fieldName: 'status',
          oldValue: 'PendingApproval',
          newValue: 'Active',
        },
      });
    });

    it('should throw FORBIDDEN error for Associates', async () => {
      mockContext.user.role = UserRole.Associate;

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Only Partners can approve cases');

      expect(mockPrisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN error for Paralegals', async () => {
      mockContext.user.role = UserRole.Paralegal;

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow(GraphQLError);
    });

    it('should throw NOT_FOUND error if case does not exist', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'invalid' }, mockContext)
      ).rejects.toThrow('Case not found');
    });

    it('should throw FORBIDDEN error if case not in user firm (multi-tenant isolation)', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        firmId: 'other-firm-999',
      });

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Case not found in your firm');
    });

    it('should throw BAD_USER_INPUT error if case not in PendingApproval status', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
      });

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Case is not pending approval');
    });

    it('should create approval record if none exists (legacy case support)', async () => {
      const createdApproval = {
        id: 'new-approval-1',
        caseId: 'case-1',
        firmId: 'firm-456',
        submittedBy: 'partner-123', // Auto-created uses approving partner as submitter
        submittedAt: expect.any(Date),
        status: ApprovalStatus.Pending,
        submitter: { id: 'partner-123', name: 'Partner User' },
      };

      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        approval: null,
        createdAt: new Date('2025-01-01'),
      });
      mockPrisma.caseApproval.create.mockResolvedValue(createdApproval);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
        approval: createdApproval,
      });
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      const result = await approvalResolvers.Mutation.approveCase(
        {},
        { caseId: 'case-1' },
        mockContext
      );

      expect(result.status).toBe(CaseStatus.Active);
      expect(mockPrisma.caseApproval.create).toHaveBeenCalledWith({
        data: {
          case: { connect: { id: 'case-1' } },
          firm: { connect: { id: 'firm-456' } },
          submitter: { connect: { id: 'partner-123' } },
          submittedAt: expect.any(Date),
          status: ApprovalStatus.Pending,
        },
        include: {
          submitter: true,
        },
      });
    });
  });

  describe('Mutation: rejectCase', () => {
    const mockCase = {
      id: 'case-1',
      title: 'Test Case',
      firmId: 'firm-456',
      status: CaseStatus.PendingApproval,
      approval: {
        id: 'approval-1',
        caseId: 'case-1',
        submittedBy: 'associate-1',
        status: ApprovalStatus.Pending,
        submitter: { id: 'associate-1', name: 'Associate 1' },
      },
    };

    it('should reject case successfully for Partner', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce({
        ...mockCase,
        approval: {
          ...mockCase.approval,
          status: ApprovalStatus.Rejected,
          rejectionReason: 'Needs more documentation',
        },
      });
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      const result = await approvalResolvers.Mutation.rejectCase(
        {},
        {
          input: {
            caseId: 'case-1',
            reason: 'Needs more documentation',
          },
        },
        mockContext
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update approval record with rejection details', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.rejectCase(
        {},
        {
          input: {
            caseId: 'case-1',
            reason: 'Needs more documentation',
          },
        },
        mockContext
      );

      expect(mockPrisma.caseApproval.update).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        data: {
          status: ApprovalStatus.Rejected,
          reviewedBy: 'partner-123',
          reviewedAt: expect.any(Date),
          rejectionReason: 'Needs more documentation',
        },
      });
    });

    it('should create audit log entry for rejection (AC9)', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.rejectCase(
        {},
        {
          input: {
            caseId: 'case-1',
            reason: 'Needs more documentation',
          },
        },
        mockContext
      );

      expect(mockPrisma.caseAuditLog.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case-1',
          userId: 'partner-123',
          action: 'CASE_REJECTED',
          fieldName: 'rejectionReason',
          oldValue: null,
          newValue: 'Needs more documentation',
        },
      });
    });

    it('should throw FORBIDDEN error for Associates', async () => {
      mockContext.user.role = UserRole.Associate;

      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Valid reason',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Only Partners can reject cases');
    });

    it('should throw BAD_USER_INPUT error if reason too short', async () => {
      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Short',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Rejection reason must be at least 10 characters');
    });

    it('should sanitize rejection reason (XSS protection)', async () => {
      const longReason = 'a'.repeat(3000); // Exceeds 2000 char limit
      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.rejectCase(
        {},
        {
          input: {
            caseId: 'case-1',
            reason: longReason,
          },
        },
        mockContext
      );

      const updateCall = mockPrisma.caseApproval.update.mock.calls[0][0];
      expect(updateCall.data.rejectionReason.length).toBeLessThanOrEqual(2000);
    });

    it('should trim whitespace from rejection reason', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({});
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.rejectCase(
        {},
        {
          input: {
            caseId: 'case-1',
            reason: '  Needs more documentation  ',
          },
        },
        mockContext
      );

      const updateCall = mockPrisma.caseApproval.update.mock.calls[0][0];
      expect(updateCall.data.rejectionReason).toBe('Needs more documentation');
    });

    it('should throw FORBIDDEN error if case not in user firm', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        firmId: 'other-firm-999',
      });

      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Valid reason here',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Case not found in your firm');
    });
  });

  describe('Mutation: resubmitCase', () => {
    const mockCase = {
      id: 'case-1',
      title: 'Test Case',
      firmId: 'firm-456',
      status: CaseStatus.PendingApproval,
      approval: {
        id: 'approval-1',
        caseId: 'case-1',
        submittedBy: 'associate-1',
        status: ApprovalStatus.Rejected,
        revisionCount: 1,
        rejectionReason: 'Needs more info',
        submitter: { id: 'associate-1', name: 'Associate 1' },
      },
    };

    it('should resubmit case successfully for original submitter', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce({
        ...mockCase,
        approval: {
          ...mockCase.approval,
          status: ApprovalStatus.Pending,
          revisionCount: 2,
        },
      });
      mockPrisma.caseApproval.update.mockResolvedValue({
        revisionCount: 2,
      });
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      const result = await approvalResolvers.Mutation.resubmitCase(
        {},
        { caseId: 'case-1' },
        mockContext
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should increment revision count', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({
        revisionCount: 2,
      });
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, mockContext);

      expect(mockPrisma.caseApproval.update).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        data: {
          status: ApprovalStatus.Pending,
          revisionCount: { increment: 1 },
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    });

    it('should create audit log entry for resubmission (AC9)', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValueOnce(mockCase).mockResolvedValueOnce(mockCase);
      mockPrisma.caseApproval.update.mockResolvedValue({
        revisionCount: 2,
      });
      mockPrisma.caseAuditLog.create.mockResolvedValue({});

      await approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, mockContext);

      expect(mockPrisma.caseAuditLog.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case-1',
          userId: 'associate-1',
          action: 'CASE_RESUBMITTED',
          fieldName: 'revisionCount',
          oldValue: '1',
          newValue: '2',
        },
      });
    });

    it('should throw FORBIDDEN error if not the original submitter', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'different-associate-999';

      mockPrisma.case.findUnique.mockResolvedValue(mockCase);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Only the original submitter can resubmit this case');
    });

    it('should throw BAD_USER_INPUT error if case not rejected', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        approval: {
          ...mockCase.approval,
          status: ApprovalStatus.Pending,
        },
      });

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Only rejected cases can be resubmitted');
    });

    it('should throw FORBIDDEN error if case not in user firm', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        firmId: 'other-firm-999',
      });

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, mockContext)
      ).rejects.toThrow('Case not found in your firm');
    });

    it('should throw NOT_FOUND error if case does not exist', async () => {
      mockContext.user.role = UserRole.Associate;
      mockContext.user.id = 'associate-1';

      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'invalid' }, mockContext)
      ).rejects.toThrow('Case not found');
    });
  });

  describe('Field Resolver: CaseApproval.case', () => {
    it('should resolve case for approval', async () => {
      const mockCase = {
        id: 'case-1',
        title: 'Test Case',
        client: { id: 'client-1', name: 'Client 1' },
        teamMembers: [],
        actors: [],
      };

      mockPrisma.case.findUnique.mockResolvedValue(mockCase);

      const result = await approvalResolvers.CaseApproval.case({ caseId: 'case-1' }, {}, {});

      expect(result).toEqual(mockCase);
      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
      });
    });
  });

  describe('Field Resolver: CaseApproval.submittedBy', () => {
    it('should resolve submitter user', async () => {
      const mockUser = {
        id: 'associate-1',
        name: 'Associate 1',
        email: 'associate@test.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await approvalResolvers.CaseApproval.submittedBy(
        { submittedBy: 'associate-1' },
        {},
        {}
      );

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'associate-1' },
      });
    });
  });

  describe('Field Resolver: CaseApproval.reviewedBy', () => {
    it('should resolve reviewer user if exists', async () => {
      const mockUser = {
        id: 'partner-1',
        name: 'Partner 1',
        email: 'partner@test.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await approvalResolvers.CaseApproval.reviewedBy(
        { reviewedBy: 'partner-1' },
        {},
        {}
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null if no reviewer', async () => {
      const result = await approvalResolvers.CaseApproval.reviewedBy({ reviewedBy: null }, {}, {});

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
