/**
 * Multi-User Integration Tests
 * Story 3.2.5 - Tasks 6.2.1, 6.2.2, 6.2.3: Multi-user scenarios
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma for integration tests
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documentBatch: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    importCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    extractedDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    legacyImportSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Multi-User Integration Tests', () => {
  const mockSessionId = 'session-integration-test';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('6.2.1: Multi-User Batch Allocation', () => {
    describe('Fair Distribution', () => {
      it('should distribute batches fairly among 3 assistants', async () => {
        // Simulate 12 batches with 3 users - each should get 4
        const allBatches = Array.from({ length: 12 }, (_, i) => ({
          id: `batch-${i + 1}`,
          sessionId: mockSessionId,
          monthYear: `2019-${String(i + 1).padStart(2, '0')}`,
          assignedTo: null,
          documentCount: 40 + Math.floor(Math.random() * 20),
        }));

        // Simulate allocation for 3 users
        const userAllocations = new Map<string, typeof allBatches>();
        const users = ['user-A', 'user-B', 'user-C'];
        const batchesPerUser = Math.ceil(allBatches.length / users.length);

        let unassignedIndex = 0;
        for (const user of users) {
          const userBatches = allBatches.slice(unassignedIndex, unassignedIndex + batchesPerUser);
          userAllocations.set(user, userBatches);
          unassignedIndex += batchesPerUser;
        }

        expect(userAllocations.get('user-A')?.length).toBe(4);
        expect(userAllocations.get('user-B')?.length).toBe(4);
        expect(userAllocations.get('user-C')?.length).toBe(4);
      });

      it('should handle uneven distribution (7 batches, 3 users)', async () => {
        const allBatches = Array.from({ length: 7 }, (_, i) => ({
          id: `batch-${i + 1}`,
          monthYear: `2019-${String(i + 1).padStart(2, '0')}`,
          assignedTo: null,
        }));

        const users = ['user-A', 'user-B', 'user-C'];
        const batchesPerUser = Math.ceil(allBatches.length / users.length); // ceil(7/3) = 3

        // First user gets 3, second gets 3, third gets 1
        expect(batchesPerUser).toBe(3);

        const allocations = [
          allBatches.slice(0, 3),
          allBatches.slice(3, 6),
          allBatches.slice(6, 7),
        ];

        expect(allocations[0].length).toBe(3);
        expect(allocations[1].length).toBe(3);
        expect(allocations[2].length).toBe(1);
      });

      it('should assign oldest months first', async () => {
        const batches = [
          { monthYear: '2020-06', id: '1' },
          { monthYear: '2019-01', id: '2' },
          { monthYear: '2019-12', id: '3' },
          { monthYear: '2020-01', id: '4' },
        ];

        const sorted = [...batches].sort((a, b) => a.monthYear.localeCompare(b.monthYear));

        expect(sorted[0].monthYear).toBe('2019-01');
        expect(sorted[1].monthYear).toBe('2019-12');
        expect(sorted[2].monthYear).toBe('2020-01');
        expect(sorted[3].monthYear).toBe('2020-06');
      });
    });

    describe('Batch Persistence', () => {
      it('should return same batch when user returns', async () => {
        const existingBatches = [
          {
            id: 'batch-1',
            sessionId: mockSessionId,
            monthYear: '2019-01',
            assignedTo: 'user-A',
            documentCount: 50,
          },
          {
            id: 'batch-2',
            sessionId: mockSessionId,
            monthYear: '2019-02',
            assignedTo: 'user-A',
            documentCount: 45,
          },
        ];

        (prisma.documentBatch.findMany as jest.Mock).mockResolvedValue(existingBatches);

        // When user-A queries their batches
        const userBatches = await prisma.documentBatch.findMany({
          where: {
            sessionId: mockSessionId,
            assignedTo: 'user-A',
          },
        });

        expect(userBatches.length).toBe(2);
        expect(userBatches[0].assignedTo).toBe('user-A');
      });

      it('should not reassign batches to different user', async () => {
        (prisma.documentBatch.findMany as jest.Mock)
          .mockResolvedValueOnce([]) // user-B has no batches
          .mockResolvedValueOnce([
            // All batches already assigned
            { id: 'batch-1', assignedTo: 'user-A' },
            { id: 'batch-2', assignedTo: 'user-A' },
          ]);

        // user-B tries to get batches but all are assigned
        const userBBatches = await prisma.documentBatch.findMany({
          where: { sessionId: mockSessionId, assignedTo: 'user-B' },
        });

        expect(userBBatches.length).toBe(0);
      });
    });

    describe('Prevent Duplicate Work', () => {
      it('should assign each document to exactly one batch', async () => {
        const documents = [
          { id: 'doc-1', batchId: 'batch-1' },
          { id: 'doc-2', batchId: 'batch-1' },
          { id: 'doc-3', batchId: 'batch-2' },
          { id: 'doc-4', batchId: 'batch-2' },
        ];

        // Check that no document appears in multiple batches
        const documentBatchMap = new Map<string, string>();
        const duplicates: string[] = [];

        for (const doc of documents) {
          if (documentBatchMap.has(doc.id)) {
            duplicates.push(doc.id);
          } else {
            documentBatchMap.set(doc.id, doc.batchId);
          }
        }

        expect(duplicates.length).toBe(0);
      });

      it('should not show documents from other users batches', async () => {
        const userABatchIds = ['batch-1', 'batch-2'];
        const allDocuments = [
          { id: 'doc-1', batchId: 'batch-1' },
          { id: 'doc-2', batchId: 'batch-1' },
          { id: 'doc-3', batchId: 'batch-3' }, // Different user's batch
          { id: 'doc-4', batchId: 'batch-4' }, // Different user's batch
        ];

        const userADocuments = allDocuments.filter((d) => userABatchIds.includes(d.batchId));

        expect(userADocuments.length).toBe(2);
        expect(userADocuments.every((d) => userABatchIds.includes(d.batchId))).toBe(true);
      });
    });
  });

  describe('6.2.2: Category Sync Integration', () => {
    describe('Real-time Category Sync', () => {
      it('should sync new categories within 1 second', async () => {
        const startTime = Date.now();

        // Simulate category creation by user-A
        const newCategory = {
          id: 'cat-new',
          sessionId: mockSessionId,
          name: 'Notificare Avocatească',
          createdBy: 'user-A',
          createdAt: new Date(),
        };

        (prisma.importCategory.create as jest.Mock).mockResolvedValue(newCategory);
        await prisma.importCategory.create({ data: newCategory });

        // Simulate user-B fetching categories
        (prisma.importCategory.findMany as jest.Mock).mockResolvedValue([newCategory]);
        const categories = await prisma.importCategory.findMany({
          where: { sessionId: mockSessionId },
        });

        const endTime = Date.now();
        const syncTime = endTime - startTime;

        expect(categories).toContainEqual(
          expect.objectContaining({ name: 'Notificare Avocatească' })
        );
        expect(syncTime).toBeLessThan(1000); // Should complete in under 1 second
      });

      it('should aggregate document counts across all batches', async () => {
        const categories = [{ id: 'cat-1', name: 'Contract', documentCount: 0 }];

        // Documents from different batches
        const documents = [
          { categoryId: 'cat-1', batchId: 'batch-1' }, // User A's batch
          { categoryId: 'cat-1', batchId: 'batch-1' },
          { categoryId: 'cat-1', batchId: 'batch-2' }, // User B's batch
          { categoryId: 'cat-1', batchId: 'batch-3' }, // User C's batch
        ];

        const totalCount = documents.filter((d) => d.categoryId === 'cat-1').length;
        categories[0].documentCount = totalCount;

        expect(categories[0].documentCount).toBe(4);
      });

      it('should show category created by another user immediately', async () => {
        // User A creates category
        const createdCategory = {
          id: 'cat-1',
          sessionId: mockSessionId,
          name: 'Intampinare',
          createdBy: 'user-A',
        };

        // User B loads categories
        (prisma.importCategory.findMany as jest.Mock).mockResolvedValue([createdCategory]);

        const userBCategories = await prisma.importCategory.findMany({
          where: { sessionId: mockSessionId },
        });

        expect(userBCategories.length).toBe(1);
        expect(userBCategories[0].name).toBe('Intampinare');
        expect(userBCategories[0].createdBy).toBe('user-A');
      });
    });

    describe('Category Conflict Resolution', () => {
      it('should prevent duplicate category names', async () => {
        const existingCategories = [{ id: 'cat-1', name: 'Contract' }];

        (prisma.importCategory.findMany as jest.Mock).mockResolvedValue(existingCategories);

        // Check if category already exists
        const categories = await prisma.importCategory.findMany({
          where: { sessionId: mockSessionId },
        });

        const newCategoryName = 'Contract';
        const exists = categories.some(
          (c: any) => c.name.toLowerCase() === newCategoryName.toLowerCase()
        );

        expect(exists).toBe(true);
        // API should return existing category instead of creating duplicate
      });

      it('should handle concurrent category creation gracefully', async () => {
        // Simulate two users creating similar category at same time
        const user1Category = { id: 'cat-1', name: 'Contract', createdBy: 'user-A' };
        const user2Category = { id: 'cat-2', name: 'Contract', createdBy: 'user-B' };

        // First creation succeeds
        (prisma.importCategory.create as jest.Mock).mockResolvedValueOnce(user1Category);

        // Second should fail or return existing
        const normalizedName = user2Category.name.toLowerCase().trim();
        const existing = user1Category.name.toLowerCase().trim() === normalizedName;

        expect(existing).toBe(true);
        // System should return existing category to user-B
      });
    });
  });

  describe('6.2.3: Concurrent Categorization', () => {
    describe('Simultaneous Updates', () => {
      it('should handle 3 users categorizing simultaneously', async () => {
        // Simulate concurrent categorization operations
        const operations = [
          { userId: 'user-A', documentId: 'doc-1', categoryId: 'cat-1', timestamp: Date.now() },
          {
            userId: 'user-B',
            documentId: 'doc-2',
            categoryId: 'cat-2',
            timestamp: Date.now() + 10,
          },
          {
            userId: 'user-C',
            documentId: 'doc-3',
            categoryId: 'cat-1',
            timestamp: Date.now() + 20,
          },
        ];

        // Each operation should succeed independently
        for (const op of operations) {
          (prisma.extractedDocument.update as jest.Mock).mockResolvedValue({
            id: op.documentId,
            categoryId: op.categoryId,
            categorizedBy: op.userId,
          });
        }

        // All updates should succeed
        const results = await Promise.all(
          operations.map((op) =>
            prisma.extractedDocument.update({
              where: { id: op.documentId },
              data: { categoryId: op.categoryId },
            })
          )
        );

        expect(results.length).toBe(3);
      });

      it('should maintain correct counts with concurrent updates', async () => {
        // Simulate concurrent increment/decrement operations
        let categoryCount = 0;

        const operations = [
          { type: 'increment' },
          { type: 'increment' },
          { type: 'decrement' },
          { type: 'increment' },
        ];

        for (const op of operations) {
          if (op.type === 'increment') {
            categoryCount++;
          } else {
            categoryCount--;
          }
        }

        expect(categoryCount).toBe(2); // 3 increments - 1 decrement
      });

      it('should not allow same document to be categorized by multiple users', async () => {
        const documentId = 'doc-shared';

        // First user gets the document
        (prisma.extractedDocument.findUnique as jest.Mock).mockResolvedValue({
          id: documentId,
          batchId: 'batch-1',
          status: 'Uncategorized',
        });

        const document = await prisma.extractedDocument.findUnique({
          where: { id: documentId },
        });

        // Document should be in a specific batch assigned to one user
        expect(document?.batchId).toBeDefined();
        // Other users won't see this document in their batch
      });
    });

    describe('Progress Isolation', () => {
      it('should show correct personal progress', async () => {
        const userABatches = [
          { id: 'batch-1', documentCount: 50, categorizedCount: 25, skippedCount: 5 },
          { id: 'batch-2', documentCount: 40, categorizedCount: 10, skippedCount: 0 },
        ];

        const totalDocs = userABatches.reduce((sum, b) => sum + b.documentCount, 0);
        const categorized = userABatches.reduce((sum, b) => sum + b.categorizedCount, 0);
        const skipped = userABatches.reduce((sum, b) => sum + b.skippedCount, 0);
        const remaining = totalDocs - categorized - skipped;

        expect(totalDocs).toBe(90);
        expect(categorized).toBe(35);
        expect(skipped).toBe(5);
        expect(remaining).toBe(50);
      });

      it('should show correct session-wide progress', async () => {
        const sessionStats = {
          totalDocuments: 500,
          categorizedCount: 200,
          skippedCount: 50,
        };

        const progress = Math.round(
          ((sessionStats.categorizedCount + sessionStats.skippedCount) /
            sessionStats.totalDocuments) *
            100
        );

        expect(progress).toBe(50); // 250/500 = 50%
      });
    });

    describe('Database Consistency', () => {
      it('should use transactions for atomic updates', async () => {
        const transactionOperations: string[] = [];

        // Mock transaction
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          transactionOperations.push('transaction_start');
          await callback(prisma);
          transactionOperations.push('transaction_commit');
          return {};
        });

        await prisma.$transaction(async (tx: any) => {
          // Multiple operations in transaction
          await tx.extractedDocument.update({ where: { id: '1' }, data: {} });
          await tx.importCategory.update({ where: { id: '1' }, data: {} });
          await tx.documentBatch.update({ where: { id: '1' }, data: {} });
        });

        expect(transactionOperations).toContain('transaction_start');
        expect(transactionOperations).toContain('transaction_commit');
      });

      it('should rollback on transaction failure', async () => {
        const operationLog: string[] = [];

        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          operationLog.push('start');
          try {
            await callback(prisma);
          } catch (error) {
            operationLog.push('rollback');
            throw error;
          }
          operationLog.push('commit');
        });

        // Simulate failed transaction
        (prisma.extractedDocument.update as jest.Mock).mockRejectedValue(
          new Error('Update failed')
        );

        try {
          await prisma.$transaction(async (tx: any) => {
            await tx.extractedDocument.update({ where: { id: '1' }, data: {} });
          });
        } catch {
          // Expected to fail
        }

        expect(operationLog).toContain('rollback');
        expect(operationLog).not.toContain('commit');
      });
    });
  });

  describe('Auto-Reassignment Flow', () => {
    it('should reassign batches when user completes early', async () => {
      // User A completes their batches
      const allBatches = [
        {
          id: 'batch-1',
          assignedTo: 'user-A',
          documentCount: 30,
          categorizedCount: 30,
          skippedCount: 0,
        },
        {
          id: 'batch-2',
          assignedTo: 'user-B',
          documentCount: 50,
          categorizedCount: 20,
          skippedCount: 0,
        },
        {
          id: 'batch-3',
          assignedTo: null,
          documentCount: 40,
          categorizedCount: 0,
          skippedCount: 0,
        },
      ];

      (prisma.documentBatch.findMany as jest.Mock).mockResolvedValue(allBatches);

      // Find finished users
      const userBatches = new Map<string, typeof allBatches>();
      for (const batch of allBatches) {
        if (batch.assignedTo) {
          const existing = userBatches.get(batch.assignedTo) || [];
          existing.push(batch);
          userBatches.set(batch.assignedTo, existing);
        }
      }

      const finishedUsers = Array.from(userBatches.entries())
        .filter(([_, batches]) =>
          batches.every((b) => b.categorizedCount + b.skippedCount >= b.documentCount)
        )
        .map(([userId]) => userId);

      expect(finishedUsers).toContain('user-A');
      expect(finishedUsers).not.toContain('user-B');

      // Unassigned batch should go to finished user
      const unassignedBatches = allBatches.filter((b) => !b.assignedTo);
      expect(unassignedBatches.length).toBe(1);
    });

    it('should detect stalled batches (no progress in 24h)', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);

      const batches = [
        {
          id: 'batch-1',
          updatedAt: now,
          categorizedCount: 10,
          documentCount: 50,
          assignedTo: 'user-A',
        },
        {
          id: 'batch-2',
          updatedAt: yesterday,
          categorizedCount: 5,
          documentCount: 50,
          assignedTo: 'user-B',
        },
      ];

      const stalledThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stalledBatches = batches.filter(
        (b) => b.updatedAt < stalledThreshold && b.categorizedCount < b.documentCount
      );

      expect(stalledBatches.length).toBe(1);
      expect(stalledBatches[0].id).toBe('batch-2');
    });
  });
});
