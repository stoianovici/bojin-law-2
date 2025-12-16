/**
 * Case Approval Authorization Integration Tests
 * Story 2.8.2: Case Approval Workflow
 *
 * Comprehensive security tests for approval workflow authorization
 * Addresses QA Gate Issue: SEC-001 (HIGH) - Authorization logic has no test coverage - security risk
 *
 * Tests multi-tenant isolation, role-based access control, and ownership verification
 */

import { prisma } from '@legal-platform/database';
import { ApprovalStatus, CaseStatus, UserRole } from '@prisma/client';
import { approvalResolvers } from '../../src/graphql/resolvers/approval.resolvers';

describe('Case Approval Authorization - Integration Tests (SEC-001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(prisma));
  });

  describe('Multi-Tenant Isolation (AC10)', () => {
    it('should prevent Associate from seeing pending cases from other firms', async () => {
      const associateContext = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      const casesFromFirmB = [
        {
          id: 'case-from-firm-b',
          firmId: 'firm-B', // Different firm
          status: CaseStatus.PendingApproval,
          approval: {
            submittedBy: 'some-other-associate',
          },
        },
      ];

      prisma.case.findMany.mockResolvedValue([]);

      await approvalResolvers.Query.myCases({}, {}, associateContext);

      // Verify query filters by the Associate's firmId
      const callArgs = prisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.firmId).toBe('firm-A');
      expect(callArgs.where.firmId).not.toBe('firm-B');
    });

    it('should prevent Partner from seeing pending cases from other firms', async () => {
      const partnerContext = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      prisma.case.findMany.mockResolvedValue([]);

      await approvalResolvers.Query.pendingCases({}, {}, partnerContext);

      // Verify query filters by the Partner's firmId
      const callArgs = prisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.firmId).toBe('firm-A');
    });

    it('should prevent Associate from accessing cases they did not submit or are not assigned to', async () => {
      const associate1Context = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      prisma.case.findMany.mockResolvedValue([]);

      await approvalResolvers.Query.myCases({}, {}, associate1Context);

      // Verify query uses OR clause for submitted OR assigned cases
      const callArgs = prisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR).toHaveLength(2);

      // Check that it filters by submitter
      expect(callArgs.where.OR[0].approval.submittedBy).toBe('associate-1');

      // Check that it filters by team membership
      expect(callArgs.where.OR[1].teamMembers.some.userId).toBe('associate-1');
    });

    it('should reject approve attempt from Partner in different firm', async () => {
      const partnerContextFirmA = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      const caseBelongingToFirmB = {
        id: 'case-1',
        firmId: 'firm-B', // Different firm
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-from-firm-b',
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseBelongingToFirmB);

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, partnerContextFirmA)
      ).rejects.toThrow('Case not found in your firm');

      // Verify no update was attempted
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it('should reject reject attempt from Partner in different firm', async () => {
      const partnerContextFirmA = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      const caseBelongingToFirmB = {
        id: 'case-1',
        firmId: 'firm-B',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-from-firm-b',
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseBelongingToFirmB);

      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Valid rejection reason',
            },
          },
          partnerContextFirmA
        )
      ).rejects.toThrow('Case not found in your firm');
    });

    it('should reject resubmit attempt from Associate in different firm', async () => {
      const associateContextFirmA = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      const caseBelongingToFirmB = {
        id: 'case-1',
        firmId: 'firm-B',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1', // Same user ID but different firm
          status: ApprovalStatus.Rejected,
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseBelongingToFirmB);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, associateContextFirmA)
      ).rejects.toThrow('Case not found in your firm');
    });
  });

  describe('Role-Based Access Control (AC5, AC6)', () => {
    it('should prevent Associate from approving cases', async () => {
      const associateContext = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, associateContext)
      ).rejects.toThrow('Only Partners can approve cases');

      // Verify no database query was made
      expect(prisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('should prevent Paralegal from approving cases', async () => {
      const paralegalContext = {
        user: {
          id: 'paralegal-1',
          firmId: 'firm-A',
          role: UserRole.Paralegal,
        },
      };

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, paralegalContext)
      ).rejects.toThrow('Only Partners can approve cases');
    });

    it('should prevent Associate from rejecting cases', async () => {
      const associateContext = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Valid rejection reason',
            },
          },
          associateContext
        )
      ).rejects.toThrow('Only Partners can reject cases');
    });

    it('should prevent Paralegal from rejecting cases', async () => {
      const paralegalContext = {
        user: {
          id: 'paralegal-1',
          firmId: 'firm-A',
          role: UserRole.Paralegal,
        },
      };

      await expect(
        approvalResolvers.Mutation.rejectCase(
          {},
          {
            input: {
              caseId: 'case-1',
              reason: 'Valid rejection reason',
            },
          },
          paralegalContext
        )
      ).rejects.toThrow('Only Partners can reject cases');
    });

    it('should prevent Paralegal from viewing pending approvals', async () => {
      const paralegalContext = {
        user: {
          id: 'paralegal-1',
          firmId: 'firm-A',
          role: UserRole.Paralegal,
        },
      };

      await expect(approvalResolvers.Query.pendingCases({}, {}, paralegalContext)).rejects.toThrow(
        'Only Partners can view pending approvals'
      );
    });

    it('should allow Partner to view pending approvals', async () => {
      const partnerContext = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      prisma.case.findMany.mockResolvedValue([]);

      await expect(
        approvalResolvers.Query.pendingCases({}, {}, partnerContext)
      ).resolves.toBeDefined();
    });

    it('should allow Partner to approve cases in their firm', async () => {
      const partnerContext = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      const mockCase = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1',
        },
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);
      prisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.Active,
      });
      prisma.caseApproval.update.mockResolvedValue({});
      prisma.caseAuditLog.create.mockResolvedValue({});

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, partnerContext)
      ).resolves.toBeDefined();
    });
  });

  describe('Ownership Verification (AC8)', () => {
    it('should prevent Associate from resubmitting case they did not submit', async () => {
      const associate2Context = {
        user: {
          id: 'associate-2',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      const caseSubmittedByAssociate1 = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1', // Different associate
          status: ApprovalStatus.Rejected,
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseSubmittedByAssociate1);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, associate2Context)
      ).rejects.toThrow('Only the original submitter can resubmit this case');

      // Verify no update was attempted
      expect(prisma.caseApproval.update).not.toHaveBeenCalled();
    });

    it('should prevent Partner from resubmitting Associate case', async () => {
      const partnerContext = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      const caseSubmittedByAssociate = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1',
          status: ApprovalStatus.Rejected,
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseSubmittedByAssociate);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, partnerContext)
      ).rejects.toThrow('Only the original submitter can resubmit this case');
    });

    it('should allow original submitter to resubmit their rejected case', async () => {
      const associate1Context = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      const rejectedCase = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1', // Same associate
          status: ApprovalStatus.Rejected,
          revisionCount: 1,
        },
      };

      prisma.case.findUnique
        .mockResolvedValueOnce(rejectedCase)
        .mockResolvedValueOnce(rejectedCase);
      prisma.caseApproval.update.mockResolvedValue({
        revisionCount: 2,
      });
      prisma.caseAuditLog.create.mockResolvedValue({});

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, associate1Context)
      ).resolves.toBeDefined();
    });
  });

  describe('Cross-Boundary Attack Scenarios', () => {
    it('should prevent privilege escalation: Associate cannot become Partner to approve', async () => {
      // Scenario: Malicious Associate tries to approve by changing role in request
      const maliciousContext = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate, // Role check happens at resolver level
        },
      };

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'any-case' }, maliciousContext)
      ).rejects.toThrow('Only Partners can approve cases');

      // Authorization check happens BEFORE any database query
      expect(prisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('should prevent horizontal privilege escalation: Associate A cannot resubmit Associate B case', async () => {
      const associateAContext = {
        user: {
          id: 'associate-A',
          firmId: 'firm-1',
          role: UserRole.Associate,
        },
      };

      const caseBelongingToAssociateB = {
        id: 'case-1',
        firmId: 'firm-1', // Same firm
        approval: {
          submittedBy: 'associate-B', // Different associate
          status: ApprovalStatus.Rejected,
        },
      };

      prisma.case.findUnique.mockResolvedValue(caseBelongingToAssociateB);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, associateAContext)
      ).rejects.toThrow('Only the original submitter can resubmit this case');
    });

    it('should prevent data leakage: Firm A Partner cannot see Firm B pending cases', async () => {
      const firmAPartnerContext = {
        user: {
          id: 'partner-A',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      // Mock returns only Firm A cases (database-level filter)
      const firmACases = [
        {
          id: 'case-A1',
          firmId: 'firm-A',
          status: CaseStatus.PendingApproval,
        },
      ];

      prisma.case.findMany.mockResolvedValue(firmACases);

      const result = await approvalResolvers.Query.pendingCases({}, {}, firmAPartnerContext);

      // Verify all returned cases belong to Firm A
      expect(result).toHaveLength(1);
      expect(result[0].firmId).toBe('firm-A');

      // Verify query included firmId filter
      const queryArgs = prisma.case.findMany.mock.calls[0][0];
      expect(queryArgs.where.firmId).toBe('firm-A');
    });

    it('should prevent case hijacking: Cannot approve case from another firm even with valid caseId', async () => {
      const firmAPartnerContext = {
        user: {
          id: 'partner-A',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      // Case belongs to Firm B
      const firmBCase = {
        id: 'stolen-case-id',
        firmId: 'firm-B',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-B',
        },
      };

      prisma.case.findUnique.mockResolvedValue(firmBCase);

      await expect(
        approvalResolvers.Mutation.approveCase(
          {},
          { caseId: 'stolen-case-id' },
          firmAPartnerContext
        )
      ).rejects.toThrow('Case not found in your firm');

      // Verify case was not approved
      expect(prisma.case.update).not.toHaveBeenCalled();
      expect(prisma.caseApproval.update).not.toHaveBeenCalled();
    });
  });

  describe('State-Based Authorization', () => {
    it('should prevent approving already approved case', async () => {
      const partnerContext = {
        user: {
          id: 'partner-1',
          firmId: 'firm-A',
          role: UserRole.Partner,
        },
      };

      const alreadyApprovedCase = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.Active, // Already approved
        approval: {
          submittedBy: 'associate-1',
          status: ApprovalStatus.Approved,
        },
      };

      prisma.case.findUnique.mockResolvedValue(alreadyApprovedCase);

      await expect(
        approvalResolvers.Mutation.approveCase({}, { caseId: 'case-1' }, partnerContext)
      ).rejects.toThrow('Case is not pending approval');
    });

    it('should prevent resubmitting case that is not rejected', async () => {
      const associateContext = {
        user: {
          id: 'associate-1',
          firmId: 'firm-A',
          role: UserRole.Associate,
        },
      };

      const pendingCase = {
        id: 'case-1',
        firmId: 'firm-A',
        status: CaseStatus.PendingApproval,
        approval: {
          submittedBy: 'associate-1',
          status: ApprovalStatus.Pending, // Not rejected
        },
      };

      prisma.case.findUnique.mockResolvedValue(pendingCase);

      await expect(
        approvalResolvers.Mutation.resubmitCase({}, { caseId: 'case-1' }, associateContext)
      ).rejects.toThrow('Only rejected cases can be resubmitted');
    });
  });
});
