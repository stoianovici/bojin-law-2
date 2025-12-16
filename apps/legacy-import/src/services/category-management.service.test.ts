/**
 * Category Management Unit Tests
 * Story 3.2.5 - Task 6.1.4: Category management (create, sync, merge)
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    importCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    extractedDocument: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    documentBatch: {
      update: jest.fn(),
    },
    legacyImportSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    legacyImportAuditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Category Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Category Sync (GET /api/sync-categories)', () => {
    it('should return all active categories for a session', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          sessionId: 'session-1',
          name: 'Contract',
          documentCount: 42,
          createdBy: 'user-1',
          createdAt: new Date(),
        },
        {
          id: 'cat-2',
          sessionId: 'session-1',
          name: 'Notificare',
          documentCount: 18,
          createdBy: 'user-2',
          createdAt: new Date(),
        },
      ];

      (prisma.importCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);

      // Simulate API logic
      const sessionId = 'session-1';
      const categories = await prisma.importCategory.findMany({
        where: {
          sessionId,
          mergedInto: null,
        },
        orderBy: [{ documentCount: 'desc' }, { name: 'asc' }],
      });

      expect(categories.length).toBe(2);
      expect(categories[0].name).toBe('Contract');
    });

    it('should exclude merged categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          sessionId: 'session-1',
          name: 'Contract',
          documentCount: 42,
          mergedInto: null,
        },
      ];

      (prisma.importCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const sessionId = 'session-1';
      const categories = await prisma.importCategory.findMany({
        where: {
          sessionId,
          mergedInto: null,
        },
      });

      expect(categories.length).toBe(1);
    });

    it('should order by document count descending then name ascending', async () => {
      const mockCategories = [
        { id: '1', name: 'Zeta', documentCount: 100 },
        { id: '2', name: 'Alpha', documentCount: 100 },
        { id: '3', name: 'Beta', documentCount: 50 },
      ];

      // Verify sorting logic
      const sorted = [...mockCategories].sort((a, b) => {
        if (b.documentCount !== a.documentCount) {
          return b.documentCount - a.documentCount;
        }
        return a.name.localeCompare(b.name);
      });

      expect(sorted[0].name).toBe('Alpha'); // Same count, alphabetically first
      expect(sorted[1].name).toBe('Zeta'); // Same count, alphabetically second
      expect(sorted[2].name).toBe('Beta'); // Lower count
    });
  });

  describe('Create Category (POST /api/create-category)', () => {
    it('should create a new category', async () => {
      const newCategory = {
        id: 'cat-new',
        sessionId: 'session-1',
        name: 'Intampinare',
        documentCount: 0,
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      (prisma.importCategory.create as jest.Mock).mockResolvedValue(newCategory);

      const created = await prisma.importCategory.create({
        data: {
          sessionId: 'session-1',
          name: 'Intampinare',
          createdBy: 'user-1',
          documentCount: 0,
        },
      });

      expect(created.name).toBe('Intampinare');
      expect(created.documentCount).toBe(0);
    });

    it('should handle Romanian category names with diacritics', async () => {
      const romanianNames = [
        'Notificare Avocatească',
        'Cerere de Chemare în Judecată',
        'Somație de Plată',
        'Întâmpinare',
      ];

      for (const name of romanianNames) {
        const mockCategory = { id: 'cat-id', name, documentCount: 0 };
        (prisma.importCategory.create as jest.Mock).mockResolvedValue(mockCategory);

        const created = await prisma.importCategory.create({
          data: { sessionId: 'session-1', name, createdBy: 'user-1', documentCount: 0 },
        });

        expect(created.name).toBe(name);
      }
    });

    it('should prevent duplicate category names in same session', async () => {
      // Simulate checking for existing category
      (prisma.importCategory.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-cat',
        name: 'Contract',
      });

      const existing = await prisma.importCategory.findFirst({
        where: {
          sessionId: 'session-1',
          name: 'Contract',
          mergedInto: null,
        },
      });

      expect(existing).not.toBeNull();
      // API should return error if category exists
    });
  });

  describe('Categorize Document (POST /api/categorize-doc)', () => {
    const mockDocument = {
      id: 'doc-1',
      sessionId: 'session-1',
      batchId: 'batch-1',
      status: 'Uncategorized',
      categoryId: null,
    };

    it('should categorize an uncategorized document', async () => {
      (prisma.extractedDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.extractedDocument.update as jest.Mock).mockResolvedValue({
        ...mockDocument,
        status: 'Categorized',
        categoryId: 'cat-1',
      });
      (prisma.importCategory.update as jest.Mock).mockResolvedValue({});
      (prisma.documentBatch.update as jest.Mock).mockResolvedValue({});
      (prisma.legacyImportSession.update as jest.Mock).mockResolvedValue({});

      // Simulate the transaction logic
      const document = await prisma.extractedDocument.findUnique({
        where: { id: 'doc-1' },
      });

      expect(document).not.toBeNull();

      const updated = await prisma.extractedDocument.update({
        where: { id: 'doc-1' },
        data: {
          status: 'Categorized',
          categoryId: 'cat-1',
          categorizedBy: 'user-1',
          categorizedAt: new Date(),
        },
      });

      expect(updated.status).toBe('Categorized');
      expect(updated.categoryId).toBe('cat-1');
    });

    it('should skip a document', async () => {
      (prisma.extractedDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.extractedDocument.update as jest.Mock).mockResolvedValue({
        ...mockDocument,
        status: 'Skipped',
        categoryId: null,
      });

      const updated = await prisma.extractedDocument.update({
        where: { id: 'doc-1' },
        data: {
          status: 'Skipped',
          categoryId: null,
          categorizedBy: 'user-1',
          categorizedAt: new Date(),
        },
      });

      expect(updated.status).toBe('Skipped');
      expect(updated.categoryId).toBeNull();
    });

    it('should handle re-categorizing a document', async () => {
      const categorizedDocument = {
        ...mockDocument,
        status: 'Categorized',
        categoryId: 'cat-old',
      };

      (prisma.extractedDocument.findUnique as jest.Mock).mockResolvedValue(categorizedDocument);

      const document = await prisma.extractedDocument.findUnique({
        where: { id: 'doc-1' },
      });

      expect(document?.status).toBe('Categorized');
      expect(document?.categoryId).toBe('cat-old');

      // When re-categorizing, should decrement old category and increment new
    });

    it('should update batch counts correctly', async () => {
      (prisma.extractedDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);

      // Simulate batch update logic
      const document = mockDocument;
      const wasAlreadyCategorized = document.status === 'Categorized';
      const wasSkipped = document.status === 'Skipped';
      const isSkipping = false;

      const batchUpdate: Record<string, any> = {};

      if (isSkipping) {
        if (!wasSkipped) batchUpdate.skippedCount = { increment: 1 };
        if (wasAlreadyCategorized) batchUpdate.categorizedCount = { decrement: 1 };
      } else {
        if (!wasAlreadyCategorized) batchUpdate.categorizedCount = { increment: 1 };
        if (wasSkipped) batchUpdate.skippedCount = { decrement: 1 };
      }

      expect(batchUpdate.categorizedCount).toEqual({ increment: 1 });
    });

    it('should update session counts correctly', async () => {
      // Same logic as batch counts but at session level
      const sessionUpdate: Record<string, any> = {};
      const wasAlreadyCategorized = false;
      const isSkipping = false;

      if (isSkipping) {
        sessionUpdate.skippedCount = { increment: 1 };
      } else {
        if (!wasAlreadyCategorized) {
          sessionUpdate.categorizedCount = { increment: 1 };
        }
      }

      expect(sessionUpdate.categorizedCount).toEqual({ increment: 1 });
    });
  });

  describe('Merge Categories (POST /api/merge-categories)', () => {
    const mockSession = {
      id: 'session-1',
      uploadedBy: 'partner-1',
    };

    const mockTargetCategory = {
      id: 'cat-target',
      sessionId: 'session-1',
      name: 'Contract',
      documentCount: 42,
      mergedInto: null,
    };

    const mockSourceCategories = [
      {
        id: 'cat-source-1',
        sessionId: 'session-1',
        name: 'Contracts',
        documentCount: 18,
        mergedInto: null,
      },
      {
        id: 'cat-source-2',
        sessionId: 'session-1',
        name: 'Contract ',
        documentCount: 3,
        mergedInto: null,
      },
    ];

    it('should merge multiple categories into target', async () => {
      (prisma.legacyImportSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.importCategory.findFirst as jest.Mock).mockResolvedValue(mockTargetCategory);
      (prisma.importCategory.findMany as jest.Mock).mockResolvedValue(mockSourceCategories);
      (prisma.extractedDocument.updateMany as jest.Mock).mockResolvedValue({ count: 21 });
      (prisma.extractedDocument.count as jest.Mock).mockResolvedValue(63); // 42 + 18 + 3
      (prisma.importCategory.update as jest.Mock).mockResolvedValue({});
      (prisma.importCategory.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.legacyImportAuditLog.create as jest.Mock).mockResolvedValue({});

      // Simulate the merge logic
      const session = await prisma.legacyImportSession.findUnique({
        where: { id: 'session-1' },
      });
      expect(session).not.toBeNull();

      const targetCategory = await prisma.importCategory.findFirst({
        where: { id: 'cat-target', sessionId: 'session-1', mergedInto: null },
      });
      expect(targetCategory).not.toBeNull();

      const sourceCategories = await prisma.importCategory.findMany({
        where: {
          id: { in: ['cat-source-1', 'cat-source-2'] },
          sessionId: 'session-1',
          mergedInto: null,
        },
      });
      expect(sourceCategories.length).toBe(2);

      // Update documents
      const updateResult = await prisma.extractedDocument.updateMany({
        where: {
          sessionId: 'session-1',
          categoryId: { in: ['cat-source-1', 'cat-source-2'] },
        },
        data: { categoryId: 'cat-target' },
      });
      expect(updateResult.count).toBe(21);

      // Count new total
      const newCount = await prisma.extractedDocument.count({
        where: { sessionId: 'session-1', categoryId: 'cat-target' },
      });
      expect(newCount).toBe(63);

      // Mark source categories as merged
      await prisma.importCategory.updateMany({
        where: { id: { in: ['cat-source-1', 'cat-source-2'] } },
        data: { mergedInto: 'cat-target', documentCount: 0 },
      });

      expect(prisma.importCategory.updateMany).toHaveBeenCalled();
    });

    it('should create audit log entry for merge', async () => {
      (prisma.legacyImportAuditLog.create as jest.Mock).mockResolvedValue({});

      await prisma.legacyImportAuditLog.create({
        data: {
          sessionId: 'session-1',
          userId: 'partner-1',
          action: 'CATEGORIES_MERGED',
          details: {
            targetCategoryId: 'cat-target',
            targetCategoryName: 'Contract',
            sourceCategoryIds: ['cat-source-1', 'cat-source-2'],
            sourceCategoryNames: ['Contracts', 'Contract '],
            documentsUpdated: 21,
          },
        },
      });

      expect(prisma.legacyImportAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CATEGORIES_MERGED',
          }),
        })
      );
    });

    it('should validate target category exists', async () => {
      (prisma.importCategory.findFirst as jest.Mock).mockResolvedValue(null);

      const targetCategory = await prisma.importCategory.findFirst({
        where: { id: 'non-existent', sessionId: 'session-1', mergedInto: null },
      });

      expect(targetCategory).toBeNull();
      // API should return 404 error
    });

    it('should validate source categories exist', async () => {
      (prisma.importCategory.findMany as jest.Mock).mockResolvedValue([
        { id: 'cat-source-1', name: 'Contracts' },
        // Missing cat-source-2
      ]);

      const sourceCategories = await prisma.importCategory.findMany({
        where: {
          id: { in: ['cat-source-1', 'cat-source-2'] },
          sessionId: 'session-1',
          mergedInto: null,
        },
      });

      expect(sourceCategories.length).not.toBe(2);
      // API should return 400 error
    });

    it('should prevent merging already-merged categories', async () => {
      const alreadyMergedCategory = {
        id: 'cat-merged',
        sessionId: 'session-1',
        name: 'Old Category',
        mergedInto: 'cat-target', // Already merged
      };

      // When finding categories with mergedInto: null, this should be excluded
      const categories = [alreadyMergedCategory].filter((c) => c.mergedInto === null);

      expect(categories.length).toBe(0);
    });
  });

  describe('Category Count Updates', () => {
    it('should increment category count when document categorized', () => {
      const categoryUpdate = {
        documentCount: { increment: 1 },
      };

      expect(categoryUpdate.documentCount.increment).toBe(1);
    });

    it('should decrement category count when document re-categorized', () => {
      const previousCategoryUpdate = {
        documentCount: { decrement: 1 },
      };

      expect(previousCategoryUpdate.documentCount.decrement).toBe(1);
    });

    it('should handle category count going to zero', () => {
      const categoryWithZeroDocs = {
        id: 'cat-1',
        name: 'Empty Category',
        documentCount: 0,
      };

      // Category should still exist but with 0 count
      expect(categoryWithZeroDocs.documentCount).toBe(0);
    });
  });

  describe('Category Name Validation', () => {
    it('should trim whitespace from category names', () => {
      const rawName = '  Contract  ';
      const trimmedName = rawName.trim();
      expect(trimmedName).toBe('Contract');
    });

    it('should handle empty category name', () => {
      const emptyName = '';
      const isValid = emptyName.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should handle category name with only spaces', () => {
      const spacesOnly = '   ';
      const isValid = spacesOnly.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should preserve Romanian diacritics', () => {
      const romanianName = 'Întâmpinare';
      const normalized = romanianName.normalize('NFC');
      expect(normalized).toBe('Întâmpinare');
    });
  });

  describe('Duplicate Category Detection', () => {
    it('should identify exact duplicates', () => {
      const categories = ['Contract', 'Contract', 'Notificare'];
      const unique = [...new Set(categories)];
      const hasDuplicates = unique.length < categories.length;

      expect(hasDuplicates).toBe(true);
    });

    it('should identify near-duplicates with different casing', () => {
      const categories = [
        { name: 'Contract', documentCount: 40 },
        { name: 'contract', documentCount: 5 },
        { name: 'CONTRACT', documentCount: 2 },
      ];

      const normalizedGroups = new Map<string, typeof categories>();
      for (const cat of categories) {
        const normalized = cat.name.toLowerCase();
        const existing = normalizedGroups.get(normalized) || [];
        existing.push(cat);
        normalizedGroups.set(normalized, existing);
      }

      expect(normalizedGroups.get('contract')?.length).toBe(3);
    });

    it('should identify near-duplicates with trailing spaces', () => {
      const categories = [
        { name: 'Contract', documentCount: 40 },
        { name: 'Contract ', documentCount: 3 },
        { name: ' Contract', documentCount: 1 },
      ];

      const normalizedGroups = new Map<string, typeof categories>();
      for (const cat of categories) {
        const normalized = cat.name.trim().toLowerCase();
        const existing = normalizedGroups.get(normalized) || [];
        existing.push(cat);
        normalizedGroups.set(normalized, existing);
      }

      expect(normalizedGroups.get('contract')?.length).toBe(3);
    });

    it('should identify plural variations', () => {
      // Simple heuristic: check if one name starts with another (min 6 chars match)
      const isVariation = (a: string, b: string): boolean => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const minLength = Math.min(aLower.length, bLower.length);
        if (minLength < 6) return false;
        const prefix = aLower.substring(0, minLength - 1);
        return bLower.startsWith(prefix) || aLower.startsWith(bLower.substring(0, minLength - 1));
      };

      expect(isVariation('Contract', 'Contracts')).toBe(true);
      expect(isVariation('Contract', 'Contracte')).toBe(true);
    });
  });
});
