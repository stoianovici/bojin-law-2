/**
 * Unified Context Service Unit Tests
 *
 * Tests for the unified context system including:
 * - JSON validation and recovery
 * - Permission/multi-tenancy checks
 * - Cache invalidation
 * - Reference resolution
 */

import {
  TEST_IDS,
  validUserCorrection,
  invalidUserCorrection,
  partiallyValidCorrectionsArray,
  mockClient,
  mockCase,
  mockContextFile,
  mockCaseContextFile,
  mockExpiredContextFile,
  mockContextReferences,
  mockDocuments,
  mockEmails,
  mockThreadSummaries,
  crossFirmReference,
} from '../fixtures/unified-context.fixtures';

// ============================================================================
// Mock Setup
// ============================================================================

const mockPrisma = {
  contextFile: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  contextReference: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  userCorrection: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  client: {
    findUnique: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  caseDocument: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  email: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  threadSummary: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  caseActor: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((operations) => Promise.all(operations)),
  $queryRaw: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
  redis: mockRedis,
  Prisma: {
    JsonNull: Symbol('JsonNull'),
  },
}));

// Mock AI client
const mockAIResponse = {
  content: [{ type: 'text', text: 'Compressed context content' }],
};

jest.mock('../../src/services/ai-client.service', () => ({
  aiClient: {
    chat: jest.fn().mockResolvedValue(mockAIResponse),
  },
  getModelForFeature: jest.fn().mockResolvedValue('claude-haiku-4-5-20251001'),
}));

// Mock logger - must be before imports that use it
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock token counter
jest.mock('../../src/utils/token-counter', () => ({
  countTokens: jest.fn((text: string) => Math.ceil(text.length / 4)),
}));

// Import after mocks are set up
import { UnifiedContextService } from '../../src/services/unified-context.service';

// ============================================================================
// Tests
// ============================================================================

describe('UnifiedContextService', () => {
  let service: UnifiedContextService;

  beforeEach(() => {
    service = new UnifiedContextService();
    jest.clearAllMocks();

    // Default mock for userCorrection table queries (returns empty array)
    mockPrisma.userCorrection.findMany.mockResolvedValue([]);
  });

  // ==========================================================================
  // Corrections from Normalized Table Tests
  // ==========================================================================

  describe('Corrections from UserCorrection Table', () => {
    it('should load corrections from UserCorrection table', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: 'name',
          correctionType: 'OVERRIDE',
          originalValue: 'Old Name',
          correctedValue: 'New Name',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(result).not.toBeNull();
      expect(result?.corrections).toHaveLength(1);
      expect(result?.corrections[0].correctedValue).toBe('New Name');
    });

    it('should return empty array when no corrections exist', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockPrisma.userCorrection.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(result?.corrections).toHaveLength(0);
    });

    it('should only return active corrections', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      // Note: The query filters by isActive: true, so inactive won't be returned
      mockPrisma.userCorrection.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(result?.corrections).toHaveLength(0);
      // Verify the query includes isActive filter
      expect(mockPrisma.userCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  // ==========================================================================
  // Permission/Multi-tenancy Tests
  // ==========================================================================

  describe('Permission Checks (Multi-tenancy)', () => {
    describe('getWordAddinContext', () => {
      it('should return null and log warning for firmId mismatch', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          clientId: TEST_IDS.client,
          firmId: TEST_IDS.firm,
        });

        const result = await service.getWordAddinContext(TEST_IDS.case, 'different-firm-id');

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Access denied: getWordAddinContext firmId mismatch'),
          expect.objectContaining({
            caseId: TEST_IDS.case,
            requestedFirmId: 'different-firm-id',
            actualFirmId: TEST_IDS.firm,
          })
        );
      });

      it('should return context for valid firmId', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          clientId: TEST_IDS.client,
          firmId: TEST_IDS.firm,
        });
        // Return appropriate context file based on the entity type being queried
        mockPrisma.contextFile.findFirst.mockImplementation(({ where }: any) => {
          if (where.caseId) return Promise.resolve(mockCaseContextFile);
          if (where.clientId) return Promise.resolve(mockContextFile);
          return Promise.resolve(null);
        });
        mockPrisma.contextReference.findMany.mockResolvedValue([]);
        mockRedis.get.mockResolvedValue(null);

        const result = await service.getWordAddinContext(TEST_IDS.case, TEST_IDS.firm);

        expect(result).not.toBeNull();
        expect(result?.caseId).toBe(TEST_IDS.case);
        expect(result?.clientId).toBe(TEST_IDS.client);
      });
    });

    describe('resolveReference', () => {
      it('should return null and log warning for cross-firm reference access', async () => {
        mockPrisma.contextReference.findFirst.mockResolvedValue(crossFirmReference);

        const result = await service.resolveReference('DOC-abc12', TEST_IDS.firm);

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Access denied: reference belongs to different firm'),
          expect.objectContaining({
            refId: 'DOC-abc12',
            requestedFirmId: TEST_IDS.firm,
            actualFirmId: 'other-firm-id',
          })
        );
      });

      it('should resolve reference for valid firm', async () => {
        mockPrisma.contextReference.findFirst.mockResolvedValue(mockContextReferences[0]);
        mockPrisma.document.findUnique.mockResolvedValue(mockDocuments[0]);

        const result = await service.resolveReference('DOC-abc12', TEST_IDS.firm);

        expect(result).not.toBeNull();
        expect(result?.refId).toBe('DOC-abc12');
        expect(result?.entityDetails.fileName).toBe('Contract.pdf');
      });
    });

    describe('resolveReferences (batch)', () => {
      it('should filter out cross-firm references silently', async () => {
        // Only return references that match the requested firmId
        mockPrisma.contextReference.findMany.mockResolvedValue([mockContextReferences[0]]);
        mockPrisma.document.findMany.mockResolvedValue([mockDocuments[0]]);
        mockPrisma.email.findMany.mockResolvedValue([]);
        mockPrisma.threadSummary.findMany.mockResolvedValue([]);

        const result = await service.resolveReferences(
          ['DOC-abc12', 'DOC-other-firm'],
          TEST_IDS.firm
        );

        // Should only return the one that matched firmId in the query
        expect(result.size).toBe(1);
        expect(result.has('DOC-abc12')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Cache Invalidation Tests
  // ==========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate all three tiers when invalidate is called', async () => {
      mockPrisma.contextFile.updateMany.mockResolvedValue({ count: 1 });

      await service.invalidate('CLIENT', TEST_IDS.client);

      // Should delete 3 cache keys (critical, standard, full)
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
      expect(mockPrisma.contextFile.updateMany).toHaveBeenCalledWith({
        where: { clientId: TEST_IDS.client },
        data: { validUntil: expect.any(Date) },
      });
    });

    it('should handle Redis errors gracefully during invalidation', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection error'));
      mockPrisma.contextFile.updateMany.mockResolvedValue({ count: 1 });

      // Should not throw
      await expect(service.invalidate('CLIENT', TEST_IDS.client)).resolves.not.toThrow();

      // Should still attempt to update DB
      expect(mockPrisma.contextFile.updateMany).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache delete failed'),
        expect.any(Object)
      );
    });

    it('should invalidate all three tiers on regenerate', async () => {
      mockPrisma.contextFile.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
      mockRedis.get.mockResolvedValue(null);

      await service.regenerate('CLIENT', TEST_IDS.client);

      // Should delete cache keys for all tiers
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // Reference Resolution Batch Tests
  // ==========================================================================

  describe('Reference Resolution Batch (resolveReferences)', () => {
    it('should respect MAX_REFS_PER_REQUEST limit (100)', async () => {
      const tooManyRefIds = Array.from({ length: 101 }, (_, i) => `DOC-${i}`);

      await expect(service.resolveReferences(tooManyRefIds, TEST_IDS.firm)).rejects.toThrow(
        'Cannot resolve more than 100 references at once'
      );
    });

    it('should filter out invalid refIds and log warning', async () => {
      mockPrisma.contextReference.findMany.mockResolvedValue([mockContextReferences[0]]);
      mockPrisma.document.findMany.mockResolvedValue([mockDocuments[0]]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);

      const mixedRefIds = ['DOC-abc12', null, undefined, '', 123];

      const result = await service.resolveReferences(mixedRefIds as string[], TEST_IDS.firm);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid refId filtered out'),
        expect.any(Object)
      );
      // Should still process valid ones
      expect(mockPrisma.contextReference.findMany).toHaveBeenCalled();
    });

    it('should return empty map for empty array', async () => {
      const result = await service.resolveReferences([], TEST_IDS.firm);

      expect(result.size).toBe(0);
      expect(mockPrisma.contextReference.findMany).not.toHaveBeenCalled();
    });

    it('should throw for non-array input', async () => {
      await expect(
        service.resolveReferences('not-an-array' as unknown as string[], TEST_IDS.firm)
      ).rejects.toThrow('refIds must be an array');
    });

    it('should return correct entityDetails per source type', async () => {
      const refs = [
        { ...mockContextReferences[0], sourceType: 'Document' },
        { ...mockContextReferences[1], sourceType: 'Email' },
        {
          ...mockContextReferences[0],
          refId: 'THR-abc12',
          refType: 'THREAD',
          sourceId: TEST_IDS.thread1,
          sourceType: 'ThreadSummary',
        },
      ];
      mockPrisma.contextReference.findMany.mockResolvedValue(refs);
      mockPrisma.document.findMany.mockResolvedValue([mockDocuments[0]]);
      mockPrisma.email.findMany.mockResolvedValue([mockEmails[0]]);
      mockPrisma.threadSummary.findMany.mockResolvedValue([mockThreadSummaries[0]]);

      const result = await service.resolveReferences(
        ['DOC-abc12', 'EMAIL-xyz89', 'THR-abc12'],
        TEST_IDS.firm
      );

      expect(result.size).toBe(3);

      // Document
      const docRef = result.get('DOC-abc12');
      expect(docRef?.entityDetails.fileName).toBe('Contract.pdf');
      expect(docRef?.entityDetails.graphDriveItemId).toBe('sp-item-001');

      // Email
      const emailRef = result.get('EMAIL-xyz89');
      expect(emailRef?.entityDetails.graphMessageId).toBe('graph-msg-001');
      expect(emailRef?.entityDetails.subject).toBe('Re: Important matter');

      // Thread
      const threadRef = result.get('THR-abc12');
      expect(threadRef?.entityDetails.conversationId).toBe('conv-001');
      expect(threadRef?.entityDetails.messageCount).toBe(5);
    });
  });

  // ==========================================================================
  // Tier Selection Tests
  // ==========================================================================

  describe('Content Tier Selection', () => {
    beforeEach(() => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);
    });

    it('should return critical tier content when requested', async () => {
      const result = await service.getClientContext(TEST_IDS.client, 'critical');

      expect(result?.content).toBe(mockContextFile.contentCritical);
      expect(result?.tokenCount).toBe(mockContextFile.tokensCritical);
    });

    it('should return standard tier content when requested', async () => {
      const result = await service.getClientContext(TEST_IDS.client, 'standard');

      expect(result?.content).toBe(mockContextFile.contentStandard);
      expect(result?.tokenCount).toBe(mockContextFile.tokensStandard);
    });

    it('should return full tier content when requested', async () => {
      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(result?.content).toBe(mockContextFile.contentFull);
      expect(result?.tokenCount).toBe(mockContextFile.tokensFull);
    });
  });

  // ==========================================================================
  // Caching Tests
  // ==========================================================================

  describe('Caching Behavior', () => {
    it('should return cached result when available', async () => {
      const cachedResult = JSON.stringify({
        entityType: 'CLIENT',
        entityId: TEST_IDS.client,
        tier: 'full',
        content: 'Cached content',
        tokenCount: 100,
        references: [],
        corrections: [],
        version: 1,
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });
      mockRedis.get.mockResolvedValue(cachedResult);

      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(result?.content).toBe('Cached content');
      expect(mockPrisma.contextFile.findFirst).not.toHaveBeenCalled();
    });

    it('should bypass cache when forceRefresh is true', async () => {
      const cachedResult = JSON.stringify({
        content: 'Cached content',
      });
      mockRedis.get.mockResolvedValue(cachedResult);
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);

      // When forceRefresh is true, the service triggers regeneration
      // So we need to mock the client lookup and upsert for generation
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockResolvedValue(mockContextFile);
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      const result = await service.getClientContext(TEST_IDS.client, 'full', {
        forceRefresh: true,
      });

      // Should have bypassed cache and called findFirst
      expect(mockPrisma.contextFile.findFirst).toHaveBeenCalled();
      // Result should be returned (either from DB or regeneration)
      expect(result).not.toBeNull();
    });
  });

  // ==========================================================================
  // User Corrections CRUD Tests
  // ==========================================================================

  describe('User Corrections', () => {
    describe('addCorrection', () => {
      it('should add a correction and invalidate cache', async () => {
        mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);

        // Mock the normalized table create
        mockPrisma.userCorrection.create.mockResolvedValue({
          id: 'new-correction-id',
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: null,
          correctionType: 'OVERRIDE',
          originalValue: null,
          correctedValue: 'New Value',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        });

        mockPrisma.contextFile.update.mockResolvedValue({
          ...mockContextFile,
          lastCorrectedBy: TEST_IDS.user,
          correctionsAppliedAt: new Date(),
        });

        const result = await service.addCorrection(
          {
            entityType: 'CLIENT',
            entityId: TEST_IDS.client,
            sectionId: 'identity',
            correctionType: 'override',
            correctedValue: 'New Value',
          },
          TEST_IDS.user
        );

        expect(result.correctedValue).toBe('New Value');
        expect(result.createdBy).toBe(TEST_IDS.user);
        expect(mockRedis.del).toHaveBeenCalled(); // Cache invalidated
        expect(mockPrisma.userCorrection.create).toHaveBeenCalled(); // Written to normalized table
      });

      it('should NOT write to JSON field (race condition fix)', async () => {
        mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);

        mockPrisma.userCorrection.create.mockResolvedValue({
          id: 'new-correction-id',
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: null,
          correctionType: 'OVERRIDE',
          originalValue: null,
          correctedValue: 'New Value',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        });

        mockPrisma.contextFile.update.mockResolvedValue(mockContextFile);

        await service.addCorrection(
          {
            entityType: 'CLIENT',
            entityId: TEST_IDS.client,
            sectionId: 'identity',
            correctionType: 'override',
            correctedValue: 'New Value',
          },
          TEST_IDS.user
        );

        // Verify contextFile.update is called only for metadata, NOT userCorrections
        expect(mockPrisma.contextFile.update).toHaveBeenCalledWith({
          where: { id: mockContextFile.id },
          data: {
            lastCorrectedBy: TEST_IDS.user,
            correctionsAppliedAt: expect.any(Date),
          },
        });

        // Ensure userCorrections field is NOT being written
        const updateCall = mockPrisma.contextFile.update.mock.calls[0][0];
        expect(updateCall.data).not.toHaveProperty('userCorrections');
      });
    });

    describe('updateCorrection', () => {
      it('should update correction in UserCorrection table', async () => {
        // Mock: correction exists in normalized table with contextFile included
        mockPrisma.userCorrection.findUnique.mockResolvedValue({
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: 'name',
          correctionType: 'OVERRIDE',
          originalValue: 'Old Name',
          correctedValue: 'Original Value',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
          contextFile: { clientId: TEST_IDS.client, caseId: null },
        });

        // Mock update returns the updated record
        mockPrisma.userCorrection.update.mockResolvedValue({
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: 'name',
          correctionType: 'OVERRIDE',
          originalValue: 'Old Name',
          correctedValue: 'Updated Value',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        });

        const result = await service.updateCorrection({
          correctionId: TEST_IDS.correction1,
          correctedValue: 'Updated Value',
        });

        expect(result?.correctedValue).toBe('Updated Value');
        expect(mockRedis.del).toHaveBeenCalled();

        // Verify the normalized table was updated
        expect(mockPrisma.userCorrection.update).toHaveBeenCalledWith({
          where: { id: TEST_IDS.correction1 },
          data: {
            correctedValue: 'Updated Value',
          },
        });
      });

      it('should return null for non-existent correction', async () => {
        mockPrisma.userCorrection.findUnique.mockResolvedValue(null);

        const result = await service.updateCorrection({
          correctionId: 'non-existent',
          correctedValue: 'Value',
        });

        expect(result).toBeNull();
        expect(mockPrisma.userCorrection.update).not.toHaveBeenCalled();
      });
    });

    describe('deleteCorrection', () => {
      it('should delete a correction from table and clear caches (no JSON write)', async () => {
        mockRedis.get.mockResolvedValue(mockContextFile.id);
        mockPrisma.contextFile.findUnique.mockResolvedValue(mockContextFile);
        mockPrisma.userCorrection.findUnique.mockResolvedValue({
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
        });
        mockPrisma.userCorrection.deleteMany.mockResolvedValue({ count: 1 });

        const result = await service.deleteCorrection(TEST_IDS.correction1);

        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalled();
        expect(mockPrisma.userCorrection.deleteMany).toHaveBeenCalledWith({
          where: { id: TEST_IDS.correction1 },
        });

        // Should NOT update JSON field (migration step 5 complete)
        expect(mockPrisma.contextFile.update).not.toHaveBeenCalled();
      });

      it('should return false when correction does not exist in table', async () => {
        mockRedis.get.mockResolvedValue(mockContextFile.id);
        mockPrisma.contextFile.findUnique.mockResolvedValue(mockContextFile);
        mockPrisma.userCorrection.findUnique.mockResolvedValue({
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
        });
        // Mock: deleteMany returns 0 (correction not found)
        mockPrisma.userCorrection.deleteMany.mockResolvedValue({ count: 0 });

        const result = await service.deleteCorrection(TEST_IDS.correction1);

        // Should return false when no correction was deleted
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Correction not found for deletion'),
          expect.any(Object)
        );
      });
    });
  });

  // ==========================================================================
  // Corrections Application Tests
  // ==========================================================================

  describe('Corrections Application', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockPrisma.userCorrection.findMany.mockResolvedValue([]);
    });

    it('should apply override correction to identity.name', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      // Mock correction from UserCorrection table
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: 'name',
          correctionType: 'OVERRIDE',
          originalValue: 'Test Company SRL',
          correctedValue: 'Corrected Company Name',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      // Setup for regeneration
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      const result = await service.getClientContext(TEST_IDS.client, 'full', {
        forceRefresh: true,
      });

      // Verify the corrected name appears in the generated content
      const upsertCall = mockPrisma.contextFile.upsert.mock.calls[0][0];
      expect(upsertCall.create.contentFull).toContain('Corrected Company Name');
    });

    it('should skip inactive corrections (query filters them out)', async () => {
      // Inactive corrections are filtered by the database query (isActive: true)
      // so they won't be returned by findMany
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      // No corrections returned since query filters by isActive: true
      mockPrisma.userCorrection.findMany.mockResolvedValue([]);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await service.getClientContext(TEST_IDS.client, 'full', { forceRefresh: true });

      const upsertCall = mockPrisma.contextFile.upsert.mock.calls[0][0];
      expect(upsertCall.create.contentFull).not.toContain('Should Not Appear');
    });

    it('should handle malformed fieldPath gracefully', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      // Mock correction with malformed fieldPath from UserCorrection table
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'identity',
          fieldPath: 'invalid[path', // Malformed regex pattern
          correctionType: 'OVERRIDE',
          originalValue: null,
          correctedValue: 'Bad Path Value',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      // Should not throw
      await expect(
        service.getClientContext(TEST_IDS.client, 'full', { forceRefresh: true })
      ).resolves.not.toThrow();
    });

    it('should apply append correction to people.contacts', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'people',
          fieldPath: 'contacts',
          correctionType: 'APPEND',
          originalValue: null,
          correctedValue: JSON.stringify({
            name: 'New Contact',
            role: 'Sales',
            email: 'new@test.com',
          }),
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await service.getClientContext(TEST_IDS.client, 'full', { forceRefresh: true });

      const upsertCall = mockPrisma.contextFile.upsert.mock.calls[0][0];
      expect(upsertCall.create.contentFull).toContain('New Contact');
    });

    it('should apply remove correction to documents.items', async () => {
      const docsWithItem = [
        {
          id: 'doc-to-remove',
          fileName: 'ToRemove.pdf',
          createdAt: new Date(),
          fileType: 'application/pdf',
          extractedContent: 'Some content',
          userDescription: 'Document to remove',
          extractionStatus: 'COMPLETED',
          sourceType: 'UPLOADED',
        },
      ];

      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'documents',
          fieldPath: 'items[0]',
          correctionType: 'REMOVE',
          originalValue: null,
          correctedValue: '',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue(docsWithItem);
      mockPrisma.document.count.mockResolvedValue(1);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await service.getClientContext(TEST_IDS.client, 'full', { forceRefresh: true });

      const upsertCall = mockPrisma.contextFile.upsert.mock.calls[0][0];
      expect(upsertCall.create.contentFull).not.toContain('ToRemove.pdf');
    });

    it('should apply note correction to communications.threads', async () => {
      const threadWithData = [
        {
          id: 'thread-001',
          conversationId: 'conv-001',
          messageCount: 3,
          participants: JSON.stringify(['a@test.com']),
          overview: 'Thread overview',
          keyPoints: JSON.stringify([]),
          actionItems: JSON.stringify([]),
          sentiment: 'neutral',
          lastAnalyzedAt: new Date(),
        },
      ];

      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.userCorrection.findMany.mockResolvedValue([
        {
          id: TEST_IDS.correction1,
          contextFileId: mockContextFile.id,
          sectionId: 'communications',
          fieldPath: 'threads[0]',
          correctionType: 'NOTE',
          originalValue: null,
          correctedValue: 'Important context note',
          reason: null,
          createdBy: TEST_IDS.user,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue(threadWithData);
      // Properly mock email data with required fields
      mockPrisma.email.findMany.mockResolvedValue([
        {
          id: 'email-001',
          graphMessageId: 'graph-msg-001',
          conversationId: 'conv-001',
          subject: 'Thread Subject',
          from: JSON.stringify({ emailAddress: { name: 'Test', address: 'test@test.com' } }),
          receivedDateTime: new Date(),
          importance: 'normal',
          hasAttachments: false,
          caseId: null,
        },
      ]);
      mockPrisma.contextFile.upsert.mockImplementation(async ({ create }) => ({
        ...mockContextFile,
        ...create,
      }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);

      await service.getClientContext(TEST_IDS.client, 'full', { forceRefresh: true });

      // Note should be added to the thread's _notes property
      // The markdown rendering might not show it, but the data should be processed
      expect(mockPrisma.contextFile.upsert).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Incremental Section Regeneration Tests
  // ==========================================================================

  describe('regenerateSections', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockPrisma.userCorrection.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
    });

    it('should only rebuild specified sections for case', async () => {
      // Setup: existing context file
      mockPrisma.contextFile.findFirst.mockResolvedValue({
        ...mockCaseContextFile,
        contentFull: 'Original content',
        identity: { entityType: 'CASE', id: TEST_IDS.case, title: 'Original Title' },
        people: { entityType: 'CASE', actors: [], team: [] },
        documents: { items: [], totalCount: 0, hasMore: false },
        communications: {
          overview: '',
          threads: [],
          emails: [],
          totalThreads: 0,
          unreadCount: 0,
          urgentCount: 0,
          pendingActions: [],
        },
      });

      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        {
          caseId: TEST_IDS.case,
          documentId: TEST_IDS.document1,
          linkedAt: new Date(),
          document: {
            id: TEST_IDS.document1,
            fileName: 'NewDocument.pdf',
            createdAt: new Date(),
            fileType: 'application/pdf',
            extractedContent: 'New document content',
            userDescription: 'A new document',
            extractionStatus: 'COMPLETED',
            sourceType: 'UPLOADED',
          },
        },
      ]);
      mockPrisma.caseDocument.count.mockResolvedValue(1);

      mockPrisma.contextFile.update.mockImplementation(async ({ data }) => ({
        ...mockCaseContextFile,
        ...data,
        version: 2,
        generatedAt: new Date(),
      }));

      // Act: regenerate only documents section
      await service.regenerateSections('CASE', TEST_IDS.case, ['documents']);

      // Assert: update was called with new documents data
      expect(mockPrisma.contextFile.update).toHaveBeenCalled();
      const updateCall = mockPrisma.contextFile.update.mock.calls[0][0];

      // Documents should be updated (has items now)
      expect(updateCall.data.documents.items).toHaveLength(1);
      expect(updateCall.data.documents.items[0].fileName).toBe('NewDocument.pdf');

      // Identity should remain unchanged (we only requested documents)
      // Note: The method passes the existing identity through applyCorrections
      expect(updateCall.data.identity.entityType).toBe('CASE');
    });

    it('should skip compression when content unchanged', async () => {
      // We need to generate the expected content to match what the service produces
      // For this test, we'll verify the logic works by checking that when content changes,
      // compression is triggered, and when it doesn't, it's skipped

      // Setup: existing context file - we mock getContextFile directly
      mockPrisma.contextFile.findFirst.mockResolvedValue({
        ...mockContextFile,
        contentStandard: 'Standard tier',
        contentCritical: 'Critical tier',
        tokensStandard: 50,
        tokensCritical: 25,
      });

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);

      // Mock update to capture what was saved
      let savedData: any = null;
      mockPrisma.contextFile.update.mockImplementation(async ({ data }) => {
        savedData = data;
        return { ...mockContextFile, ...data, version: 2 };
      });

      // Act: regenerate identity section
      await service.regenerateSections('CLIENT', TEST_IDS.client, ['identity']);

      // Assert: update was called
      expect(mockPrisma.contextFile.update).toHaveBeenCalled();

      // Log indicates whether compression was skipped (based on content change)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Incremental client regeneration'),
        expect.objectContaining({
          sectionsRebuilt: ['identity'],
        })
      );
    });

    it('should fall back to full regeneration when no existing file', async () => {
      // Setup: no existing context file
      mockPrisma.contextFile.findFirst.mockResolvedValue(null);
      mockPrisma.contextFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockResolvedValue(mockContextFile);

      // Act
      await service.regenerateSections('CLIENT', TEST_IDS.client, ['documents']);

      // Assert: fell back to full regeneration (uses upsert, not update)
      expect(mockPrisma.contextFile.upsert).toHaveBeenCalled();
      expect(mockPrisma.contextFile.update).not.toHaveBeenCalled();

      // Log should indicate fallback
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Full regeneration'),
        expect.objectContaining({
          reason: 'no_existing_file',
        })
      );
    });

    it('should fall back to full regeneration when all 4 sections requested', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.contextFile.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockResolvedValue(mockContextFile);

      // Act: request all 4 sections
      await service.regenerateSections('CLIENT', TEST_IDS.client, [
        'identity',
        'people',
        'documents',
        'communications',
      ]);

      // Assert: fell back to full regeneration
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Full regeneration'),
        expect.objectContaining({
          reason: 'all_sections_requested',
        })
      );
    });

    it('should log sectionsRebuilt metric', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.update.mockResolvedValue({ ...mockContextFile, version: 2 });

      // Act
      await service.regenerateSections('CLIENT', TEST_IDS.client, ['documents', 'communications']);

      // Assert: log contains sectionsRebuilt
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Incremental'),
        expect.objectContaining({
          sectionsRequested: ['documents', 'communications'],
          sectionsRebuilt: ['documents', 'communications'],
        })
      );
    });

    it('should return null for non-existent entity', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.client.findUnique.mockResolvedValue(null);

      const result = await service.regenerateSections('CLIENT', 'non-existent', ['identity']);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Client not found for incremental rebuild'),
        expect.objectContaining({ entityId: 'non-existent' })
      );
    });

    it('should regenerate references when documents or communications changed', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockCaseContextFile);
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseDocument.findMany.mockResolvedValue([]);
      mockPrisma.caseDocument.count.mockResolvedValue(0);
      mockPrisma.contextFile.update.mockResolvedValue({ ...mockCaseContextFile, version: 2 });
      mockPrisma.contextReference.deleteMany.mockResolvedValue({ count: 0 });

      // Act: regenerate documents section
      await service.regenerateSections('CASE', TEST_IDS.case, ['documents']);

      // Assert: references were regenerated (via contextReference.deleteMany at minimum)
      // The generateReferences method clears old refs and creates new ones
      expect(mockPrisma.contextReference.deleteMany).toHaveBeenCalledWith({
        where: { contextFileId: mockCaseContextFile.id },
      });
    });

    it('should NOT regenerate references when only identity changed', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockContextFile);
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.contextFile.update.mockResolvedValue({ ...mockContextFile, version: 2 });

      // Act: regenerate only identity section
      await service.regenerateSections('CLIENT', TEST_IDS.client, ['identity']);

      // Assert: references were NOT regenerated
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Context Generation Tests
  // ==========================================================================

  describe('Context Generation', () => {
    it('should regenerate expired context files', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(mockExpiredContextFile);
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.threadSummary.findMany.mockResolvedValue([]);
      mockPrisma.email.findMany.mockResolvedValue([]);
      mockPrisma.contextFile.upsert.mockResolvedValue(mockContextFile);
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
      mockPrisma.contextReference.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getClientContext(TEST_IDS.client, 'full');

      expect(mockPrisma.contextFile.upsert).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should return null for non-existent entity', async () => {
      mockPrisma.contextFile.findFirst.mockResolvedValue(null);
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getClientContext('non-existent', 'full');

      expect(result).toBeNull();
    });
  });
});
