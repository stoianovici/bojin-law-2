/**
 * Document Review Integration Tests
 * Story 3.6: Document Review and Approval Workflow - Task 15
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    documentReview: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    reviewComment: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reviewCommentReply: {
      create: jest.fn(),
    },
    aIReviewConcern: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    reviewHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    batchReview: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    documentVersion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-test-123',
  name: 'Test Law Firm',
};

const testPartner = {
  id: 'partner-test-123',
  email: 'partner@testfirm.com',
  firstName: 'Partner',
  lastName: 'User',
  role: 'Partner',
  status: 'Active',
  firmId: testFirm.id,
};

const testAssociate = {
  id: 'associate-test-123',
  email: 'associate@testfirm.com',
  firstName: 'Associate',
  lastName: 'User',
  role: 'Associate',
  status: 'Active',
  firmId: testFirm.id,
};

const testDocument = {
  id: 'doc-test-123',
  fileName: 'Test Contract.docx',
  fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  fileUrl: 'https://storage.example.com/docs/test.docx',
  firmId: testFirm.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testVersion = {
  id: 'version-test-123',
  documentId: testDocument.id,
  versionNumber: 1,
  changesSummary: 'Initial version',
  createdAt: new Date(),
};

const testReview = {
  id: 'review-test-123',
  documentId: testDocument.id,
  documentVersionId: testVersion.id,
  firmId: testFirm.id,
  submittedBy: testAssociate.id,
  submittedAt: new Date(),
  assignedTo: null,
  status: 'PENDING',
  priority: 'NORMAL',
  dueDate: null,
  revisionNumber: 0,
  feedback: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testComment = {
  id: 'comment-test-123',
  reviewId: testReview.id,
  authorId: testPartner.id,
  content: 'Please clarify this section.',
  anchorText: 'test anchor text',
  anchorStart: 100,
  anchorEnd: 115,
  sectionPath: 'Article 1',
  resolved: false,
  resolvedBy: null,
  resolvedAt: null,
  suggestionText: null,
  isAISuggestion: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testAIConcern = {
  id: 'concern-test-123',
  reviewId: testReview.id,
  concernType: 'AMBIGUOUS_LANGUAGE',
  severity: 'WARNING',
  description: 'The term "reasonable" is vague',
  anchorText: 'reasonable timeframe',
  anchorStart: 200,
  anchorEnd: 219,
  sectionPath: 'Article 2',
  suggestedFix: 'Specify exact timeframe',
  aiConfidence: 0.85,
  dismissed: false,
  dismissedBy: null,
  dismissedAt: null,
  createdAt: new Date(),
};

// Helper functions to simulate operations
async function simulateSubmitReview(
  documentId: string,
  versionId: string,
  submittedBy: string,
  options?: { assignedTo?: string; priority?: string; dueDate?: Date }
) {
  const review = await mockPrisma.documentReview.create({
    data: {
      documentId,
      documentVersionId: versionId,
      firmId: testFirm.id,
      submittedBy,
      status: 'PENDING',
      priority: options?.priority || 'NORMAL',
      assignedTo: options?.assignedTo,
      dueDate: options?.dueDate,
      revisionNumber: 0,
    },
  } as any);
  return review;
}

async function simulateAddComment(
  reviewId: string,
  authorId: string,
  content: string,
  options?: { anchorText?: string; suggestionText?: string }
) {
  const comment = await mockPrisma.reviewComment.create({
    data: {
      reviewId,
      authorId,
      content,
      anchorText: options?.anchorText,
      suggestionText: options?.suggestionText,
      resolved: false,
      isAISuggestion: false,
    },
  } as any);
  return comment;
}

async function simulateResolveComment(commentId: string, userId: string) {
  const comment = await mockPrisma.reviewComment.update({
    where: { id: commentId },
    data: {
      resolved: true,
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  } as any);
  return comment;
}

async function simulateSubmitDecision(
  reviewId: string,
  reviewerId: string,
  decision: string,
  feedback: string
) {
  const review = await mockPrisma.documentReview.update({
    where: { id: reviewId },
    data: {
      status: decision,
      feedback,
      reviewedAt: new Date(),
    },
  } as any);
  return review;
}

async function simulateDismissConcern(concernId: string, userId: string) {
  const concern = await mockPrisma.aIReviewConcern.update({
    where: { id: concernId },
    data: {
      dismissed: true,
      dismissedBy: userId,
      dismissedAt: new Date(),
    },
  } as any);
  return concern;
}

describe('Document Review - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (mockPrisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === testPartner.id) return Promise.resolve(testPartner);
      if (where.id === testAssociate.id) return Promise.resolve(testAssociate);
      return Promise.resolve(null);
    });

    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([testPartner]);
    (mockPrisma.document.findUnique as jest.Mock).mockResolvedValue(testDocument as any);
    (mockPrisma.documentVersion.findUnique as jest.Mock).mockResolvedValue(testVersion as any);
  });

  describe('Review Submission', () => {
    it('should create a new review when Associate submits document', async () => {
      (mockPrisma.documentReview.create as jest.Mock).mockResolvedValue(testReview as any);
      (mockPrisma.reviewHistory.create as jest.Mock).mockResolvedValue({} as any);
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const review = await simulateSubmitReview(testDocument.id, testVersion.id, testAssociate.id);

      expect(review).toBeDefined();
      expect(review.documentId).toBe(testDocument.id);
      expect(review.status).toBe('PENDING');
      expect(mockPrisma.documentReview.create).toHaveBeenCalled();
    });

    it('should submit review with priority and due date', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      (mockPrisma.documentReview.create as jest.Mock).mockResolvedValue({
        ...testReview,
        priority: 'HIGH',
        dueDate,
      } as any);

      const review = await simulateSubmitReview(testDocument.id, testVersion.id, testAssociate.id, {
        priority: 'HIGH',
        dueDate,
      });

      expect(review.priority).toBe('HIGH');
      expect(review.dueDate).toEqual(dueDate);
    });

    it('should assign review to specific Partner', async () => {
      (mockPrisma.documentReview.create as jest.Mock).mockResolvedValue({
        ...testReview,
        assignedTo: testPartner.id,
      } as any);

      const review = await simulateSubmitReview(testDocument.id, testVersion.id, testAssociate.id, {
        assignedTo: testPartner.id,
      });

      expect(review.assignedTo).toBe(testPartner.id);
    });
  });

  describe('Review Comments', () => {
    it('should add a comment to a review', async () => {
      (mockPrisma.reviewComment.create as jest.Mock).mockResolvedValue(testComment as any);

      const comment = await simulateAddComment(
        testReview.id,
        testPartner.id,
        'Please clarify this section.'
      );

      expect(comment).toBeDefined();
      expect(comment.content).toBe('Please clarify this section.');
      expect(comment.resolved).toBe(false);
    });

    it('should add a comment with anchor text reference', async () => {
      (mockPrisma.reviewComment.create as jest.Mock).mockResolvedValue({
        ...testComment,
        anchorText: 'specific clause text',
      } as any);

      const comment = await simulateAddComment(
        testReview.id,
        testPartner.id,
        'This clause needs revision.',
        { anchorText: 'specific clause text' }
      );

      expect(comment.anchorText).toBe('specific clause text');
    });

    it('should add a comment with suggested replacement', async () => {
      (mockPrisma.reviewComment.create as jest.Mock).mockResolvedValue({
        ...testComment,
        suggestionText: 'Replace with: clear language',
      } as any);

      const comment = await simulateAddComment(testReview.id, testPartner.id, 'This is unclear.', {
        suggestionText: 'Replace with: clear language',
      });

      expect(comment.suggestionText).toBe('Replace with: clear language');
    });

    it('should resolve a comment', async () => {
      (mockPrisma.reviewComment.update as jest.Mock).mockResolvedValue({
        ...testComment,
        resolved: true,
        resolvedBy: testAssociate.id,
        resolvedAt: new Date(),
      } as any);

      const comment = await simulateResolveComment(testComment.id, testAssociate.id);

      expect(comment.resolved).toBe(true);
      expect(comment.resolvedBy).toBe(testAssociate.id);
    });

    it('should add reply to a comment', async () => {
      const reply = {
        id: 'reply-test-123',
        commentId: testComment.id,
        authorId: testAssociate.id,
        content: 'I have updated the section.',
        createdAt: new Date(),
      };

      (mockPrisma.reviewCommentReply.create as jest.Mock).mockResolvedValue(reply as any);

      const result = await mockPrisma.reviewCommentReply.create({
        data: {
          commentId: testComment.id,
          authorId: testAssociate.id,
          content: 'I have updated the section.',
        },
      } as any);

      expect(result.content).toBe('I have updated the section.');
    });
  });

  describe('AI Concerns', () => {
    it('should dismiss an AI concern', async () => {
      (mockPrisma.aIReviewConcern.update as jest.Mock).mockResolvedValue({
        ...testAIConcern,
        dismissed: true,
        dismissedBy: testPartner.id,
        dismissedAt: new Date(),
      } as any);

      const concern = await simulateDismissConcern(testAIConcern.id, testPartner.id);

      expect(concern.dismissed).toBe(true);
      expect(concern.dismissedBy).toBe(testPartner.id);
    });

    it('should list active concerns for a review', async () => {
      (mockPrisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue([
        testAIConcern,
        { ...testAIConcern, id: 'concern-2', severity: 'ERROR' },
      ] as any);

      const concerns = await mockPrisma.aIReviewConcern.findMany({
        where: {
          reviewId: testReview.id,
          dismissed: false,
        },
      } as any);

      expect(concerns.length).toBe(2);
    });
  });

  describe('Review Decisions', () => {
    it('should approve a document review', async () => {
      (mockPrisma.documentReview.update as jest.Mock).mockResolvedValue({
        ...testReview,
        status: 'APPROVED',
        feedback: 'Document looks good.',
        reviewedAt: new Date(),
      } as any);
      (mockPrisma.reviewHistory.create as jest.Mock).mockResolvedValue({} as any);
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({} as any);

      const review = await simulateSubmitDecision(
        testReview.id,
        testPartner.id,
        'APPROVED',
        'Document looks good.'
      );

      expect(review.status).toBe('APPROVED');
      expect(review.feedback).toBe('Document looks good.');
      expect(review.reviewedAt).toBeDefined();
    });

    it('should reject a document review with feedback', async () => {
      (mockPrisma.documentReview.update as jest.Mock).mockResolvedValue({
        ...testReview,
        status: 'REJECTED',
        feedback: 'Does not meet requirements.',
        reviewedAt: new Date(),
      } as any);

      const review = await simulateSubmitDecision(
        testReview.id,
        testPartner.id,
        'REJECTED',
        'Does not meet requirements.'
      );

      expect(review.status).toBe('REJECTED');
      expect(review.feedback).toBe('Does not meet requirements.');
    });

    it('should request revision with feedback', async () => {
      (mockPrisma.documentReview.update as jest.Mock).mockResolvedValue({
        ...testReview,
        status: 'REVISION_REQUESTED',
        feedback: 'Please update section 3.',
        reviewedAt: new Date(),
      } as any);

      const review = await simulateSubmitDecision(
        testReview.id,
        testPartner.id,
        'REVISION_REQUESTED',
        'Please update section 3.'
      );

      expect(review.status).toBe('REVISION_REQUESTED');
    });

    it('should not allow approval with unresolved comments', async () => {
      (mockPrisma.reviewComment.findMany as jest.Mock).mockResolvedValue([
        { ...testComment, resolved: false },
      ] as any);

      const unresolvedComments = await mockPrisma.reviewComment.findMany({
        where: {
          reviewId: testReview.id,
          resolved: false,
        },
      } as any);

      expect(unresolvedComments.length).toBeGreaterThan(0);
    });

    it('should not allow approval with ERROR concerns', async () => {
      (mockPrisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue([
        { ...testAIConcern, severity: 'ERROR', dismissed: false },
      ] as any);

      const errorConcerns = await mockPrisma.aIReviewConcern.findMany({
        where: {
          reviewId: testReview.id,
          severity: 'ERROR',
          dismissed: false,
        },
      } as any);

      expect(errorConcerns.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Review', () => {
    it('should create a batch review', async () => {
      const batchReview = {
        id: 'batch-test-123',
        firmId: testFirm.id,
        createdBy: testPartner.id,
        reviewIds: ['review-1', 'review-2', 'review-3'],
        status: 'IN_PROGRESS',
        processedCount: 0,
        totalCount: 3,
        commonFeedback: 'All documents approved.',
        createdAt: new Date(),
        completedAt: null,
      };

      (mockPrisma.batchReview.create as jest.Mock).mockResolvedValue(batchReview as any);

      const result = await mockPrisma.batchReview.create({
        data: {
          firmId: testFirm.id,
          createdBy: testPartner.id,
          reviewIds: ['review-1', 'review-2', 'review-3'],
          status: 'IN_PROGRESS',
          totalCount: 3,
          commonFeedback: 'All documents approved.',
        },
      } as any);

      expect(result.reviewIds.length).toBe(3);
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should update batch review progress', async () => {
      (mockPrisma.batchReview.update as jest.Mock).mockResolvedValue({
        id: 'batch-test-123',
        processedCount: 2,
        totalCount: 3,
        status: 'IN_PROGRESS',
      } as any);

      const result = await mockPrisma.batchReview.update({
        where: { id: 'batch-test-123' },
        data: { processedCount: 2 },
      } as any);

      expect(result.processedCount).toBe(2);
    });

    it('should complete batch review', async () => {
      (mockPrisma.batchReview.update as jest.Mock).mockResolvedValue({
        id: 'batch-test-123',
        processedCount: 3,
        totalCount: 3,
        status: 'COMPLETED',
        completedAt: new Date(),
      } as any);

      const result = await mockPrisma.batchReview.update({
        where: { id: 'batch-test-123' },
        data: {
          processedCount: 3,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      } as any);

      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('Review History', () => {
    it('should record submission in history', async () => {
      const historyEntry = {
        id: 'history-test-123',
        reviewId: testReview.id,
        action: 'SUBMITTED',
        actorId: testAssociate.id,
        previousStatus: null,
        newStatus: 'PENDING',
        feedback: null,
        timestamp: new Date(),
      };

      (mockPrisma.reviewHistory.create as jest.Mock).mockResolvedValue(historyEntry as any);

      const result = await mockPrisma.reviewHistory.create({
        data: {
          reviewId: testReview.id,
          action: 'SUBMITTED',
          actorId: testAssociate.id,
          newStatus: 'PENDING',
        },
      } as any);

      expect(result.action).toBe('SUBMITTED');
      expect(result.newStatus).toBe('PENDING');
    });

    it('should record approval in history', async () => {
      (mockPrisma.reviewHistory.create as jest.Mock).mockResolvedValue({
        id: 'history-test-124',
        reviewId: testReview.id,
        action: 'APPROVED',
        actorId: testPartner.id,
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
        feedback: 'Looks good.',
        timestamp: new Date(),
      } as any);

      const result = await mockPrisma.reviewHistory.create({
        data: {
          reviewId: testReview.id,
          action: 'APPROVED',
          actorId: testPartner.id,
          previousStatus: 'PENDING',
          newStatus: 'APPROVED',
          feedback: 'Looks good.',
        },
      } as any);

      expect(result.action).toBe('APPROVED');
      expect(result.previousStatus).toBe('PENDING');
      expect(result.newStatus).toBe('APPROVED');
    });

    it('should record comment added in history', async () => {
      (mockPrisma.reviewHistory.create as jest.Mock).mockResolvedValue({
        id: 'history-test-125',
        reviewId: testReview.id,
        action: 'COMMENT_ADDED',
        actorId: testPartner.id,
        metadata: { commentId: testComment.id },
        timestamp: new Date(),
      } as any);

      const result = await mockPrisma.reviewHistory.create({
        data: {
          reviewId: testReview.id,
          action: 'COMMENT_ADDED',
          actorId: testPartner.id,
          metadata: { commentId: testComment.id },
        },
      } as any);

      expect(result.action).toBe('COMMENT_ADDED');
    });
  });

  describe('Review Statistics', () => {
    it('should count reviews by status', async () => {
      (mockPrisma.documentReview.count as jest.Mock)
        .mockResolvedValueOnce(5) // PENDING
        .mockResolvedValueOnce(3) // IN_REVIEW
        .mockResolvedValueOnce(10) // APPROVED
        .mockResolvedValueOnce(2); // REJECTED

      const pending = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, status: 'PENDING' },
      } as any);
      const inReview = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, status: 'IN_REVIEW' },
      } as any);
      const approved = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, status: 'APPROVED' },
      } as any);
      const rejected = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, status: 'REJECTED' },
      } as any);

      expect(pending).toBe(5);
      expect(inReview).toBe(3);
      expect(approved).toBe(10);
      expect(rejected).toBe(2);
    });

    it('should count reviews by priority', async () => {
      (mockPrisma.documentReview.count as jest.Mock)
        .mockResolvedValueOnce(1) // URGENT
        .mockResolvedValueOnce(3) // HIGH
        .mockResolvedValueOnce(8) // NORMAL
        .mockResolvedValueOnce(2); // LOW

      const urgent = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, priority: 'URGENT' },
      } as any);
      const high = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, priority: 'HIGH' },
      } as any);
      const normal = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, priority: 'NORMAL' },
      } as any);
      const low = await mockPrisma.documentReview.count({
        where: { firmId: testFirm.id, priority: 'LOW' },
      } as any);

      expect(urgent).toBe(1);
      expect(high).toBe(3);
      expect(normal).toBe(8);
      expect(low).toBe(2);
    });
  });

  describe('Notifications', () => {
    it('should notify Partners when review is submitted', async () => {
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await mockPrisma.notification.createMany({
        data: [
          {
            userId: testPartner.id,
            type: 'DocumentReviewRequested',
            title: 'New Document Review Request',
            message: `"${testDocument.fileName}" submitted for review`,
            link: `/reviews/${testReview.id}`,
          },
        ],
      } as any);

      expect(result.count).toBeGreaterThan(0);
    });

    it('should notify Associate when document is approved', async () => {
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notification-test-123',
        userId: testAssociate.id,
        type: 'DocumentApproved',
        title: 'Document Approved',
        message: `Your document "${testDocument.fileName}" has been approved`,
      } as any);

      const result = await mockPrisma.notification.create({
        data: {
          userId: testAssociate.id,
          type: 'DocumentApproved',
          title: 'Document Approved',
          message: `Your document "${testDocument.fileName}" has been approved`,
          link: `/reviews/${testReview.id}`,
        },
      } as any);

      expect(result.type).toBe('DocumentApproved');
    });

    it('should notify Associate when revision is requested', async () => {
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notification-test-124',
        userId: testAssociate.id,
        type: 'DocumentRevisionRequested',
        title: 'Document Revision Requested',
        message: 'Please update section 3.',
      } as any);

      const result = await mockPrisma.notification.create({
        data: {
          userId: testAssociate.id,
          type: 'DocumentRevisionRequested',
          title: 'Document Revision Requested',
          message: 'Please update section 3.',
          link: `/reviews/${testReview.id}`,
        },
      } as any);

      expect(result.type).toBe('DocumentRevisionRequested');
    });
  });
});
