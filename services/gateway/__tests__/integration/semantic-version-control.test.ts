/**
 * Semantic Version Control Integration Tests
 * Story 3.5: Semantic Version Control System - Task 16
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { semanticVersionControlResolvers } from '../../src/graphql/resolvers/semantic-version-control.resolvers';
import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';

// Mock Prisma
vi.mock('@legal-platform/database', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
    documentVersion: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    versionComparisonCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    semanticChange: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    responseSuggestion: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock fetch for AI Service calls
global.fetch = vi.fn();

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Semantic Version Control Resolvers - Integration', () => {
  const mockUser = {
    id: 'user-123',
    firmId: 'firm-123',
    role: 'Associate' as const,
    email: 'user@example.com',
  };

  const mockContext = {
    user: mockUser,
  };

  const mockDocument = {
    id: 'doc-123',
    firmId: 'firm-123',
    clientId: 'client-123',
    fileType: 'docx',
  };

  const mockVersion = {
    id: 'version-123',
    documentId: 'doc-123',
    versionNumber: 1,
    oneDriveVersionId: 'od-123',
    changesSummary: 'Initial version',
    createdAt: new Date(),
    creator: {
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.documentVersion.findUnique).mockResolvedValue(mockVersion as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue(mockVersion as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Query: compareVersions', () => {
    const input = {
      documentId: 'doc-123',
      fromVersionId: 'version-1',
      toVersionId: 'version-2',
    };

    it('should require authentication', async () => {
      const unauthContext = { user: undefined };

      await expect(
        semanticVersionControlResolvers.Query.compareVersions(null, { input }, unauthContext as any)
      ).rejects.toThrow(GraphQLError);
    });

    it('should require Associate or Partner role', async () => {
      const paralegalContext = {
        user: { ...mockUser, role: 'Paralegal' as const },
      };

      await expect(
        semanticVersionControlResolvers.Query.compareVersions(
          null,
          { input },
          paralegalContext as any
        )
      ).rejects.toThrow('Version control operations require Associate or Partner role');
    });

    it('should return cached comparison if available', async () => {
      const cachedComparison = {
        fromVersionId: 'version-1',
        toVersionId: 'version-2',
        comparisonData: {
          changes: [],
          totalChanges: 0,
          changeBreakdown: {
            formatting: 0,
            minorWording: 0,
            substantive: 0,
            critical: 0,
          },
        },
        summary: 'No changes detected',
        aggregateRisk: 'LOW',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };

      vi.mocked(prisma.versionComparisonCache.findUnique).mockResolvedValue(
        cachedComparison as any
      );

      vi.mocked(prisma.documentVersion.findUnique).mockResolvedValue({
        ...mockVersion,
        creator: mockVersion.creator,
      } as any);

      const result = await semanticVersionControlResolvers.Query.compareVersions(
        null,
        { input },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.executiveSummary).toBe('No changes detected');
    });

    it('should fetch from AI service when cache is expired', async () => {
      const expiredCache = {
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      vi.mocked(prisma.versionComparisonCache.findUnique).mockResolvedValue(expiredCache as any);

      const aiResponse = {
        changes: [
          {
            id: 'change-1',
            changeType: 'MODIFIED',
            significance: 'SUBSTANTIVE',
            beforeText: 'Old text',
            afterText: 'New text',
            plainSummary: 'Text was modified',
          },
        ],
        executiveSummary: 'One substantive change detected',
        aggregateRisk: 'MEDIUM',
        totalChanges: 1,
        changeBreakdown: {
          formatting: 0,
          minorWording: 0,
          substantive: 1,
          critical: 0,
        },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse),
      } as Response);

      vi.mocked(prisma.documentVersion.findUnique).mockResolvedValue({
        ...mockVersion,
        creator: mockVersion.creator,
      } as any);

      const result = await semanticVersionControlResolvers.Query.compareVersions(
        null,
        { input },
        mockContext
      );

      expect(result.executiveSummary).toBe('One substantive change detected');
      expect(result.aggregateRisk).toBe('MEDIUM');
    });

    it('should deny access for documents from other firms', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...mockDocument,
        firmId: 'other-firm',
      } as any);

      await expect(
        semanticVersionControlResolvers.Query.compareVersions(null, { input }, mockContext)
      ).rejects.toThrow('Document not found or access denied');
    });
  });

  describe('Query: documentVersionTimeline', () => {
    it('should return version timeline', async () => {
      const versions = [
        { ...mockVersion, versionNumber: 2 },
        { ...mockVersion, versionNumber: 1, id: 'version-1' },
      ];

      vi.mocked(prisma.documentVersion.findMany).mockResolvedValue(versions as any);

      const result = await semanticVersionControlResolvers.Query.documentVersionTimeline(
        null,
        { documentId: 'doc-123' },
        mockContext
      );

      expect(result.documentId).toBe('doc-123');
      expect(result.versions.length).toBe(2);
      expect(result.totalVersions).toBe(2);
    });

    it('should order versions by version number descending', async () => {
      const versions = [
        { ...mockVersion, versionNumber: 3, id: 'v3' },
        { ...mockVersion, versionNumber: 2, id: 'v2' },
        { ...mockVersion, versionNumber: 1, id: 'v1' },
      ];

      vi.mocked(prisma.documentVersion.findMany).mockResolvedValue(versions as any);

      const result = await semanticVersionControlResolvers.Query.documentVersionTimeline(
        null,
        { documentId: 'doc-123' },
        mockContext
      );

      expect(result.versions[0].versionNumber).toBe(3);
      expect(result.versions[2].versionNumber).toBe(1);
    });
  });

  describe('Query: semanticChanges', () => {
    const input = {
      documentId: 'doc-123',
      fromVersionId: 'version-1',
      toVersionId: 'version-2',
    };

    it('should return filtered semantic changes', async () => {
      const changes = [
        {
          id: 'change-1',
          documentId: 'doc-123',
          changeType: 'MODIFIED',
          significance: 'SUBSTANTIVE',
          responseSuggestions: [],
        },
      ];

      vi.mocked(prisma.semanticChange.findMany).mockResolvedValue(changes as any);

      const result = await semanticVersionControlResolvers.Query.semanticChanges(
        null,
        { input },
        mockContext
      );

      expect(result.length).toBe(1);
      expect(result[0].significance).toBe('SUBSTANTIVE');
    });

    it('should filter by significance', async () => {
      const inputWithFilter = {
        ...input,
        significance: 'CRITICAL',
      };

      vi.mocked(prisma.semanticChange.findMany).mockResolvedValue([]);

      await semanticVersionControlResolvers.Query.semanticChanges(
        null,
        { input: inputWithFilter },
        mockContext
      );

      expect(prisma.semanticChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            significance: 'CRITICAL',
          }),
        })
      );
    });
  });

  describe('Mutation: rollbackToVersion', () => {
    const input = {
      documentId: 'doc-123',
      targetVersionId: 'version-1',
      reason: 'Reverting to previous state',
    };

    it('should create new version as rollback', async () => {
      const targetVersion = {
        ...mockVersion,
        id: 'version-1',
        versionNumber: 1,
        documentId: 'doc-123',
      };

      const latestVersion = {
        ...mockVersion,
        versionNumber: 3,
      };

      vi.mocked(prisma.documentVersion.findUnique).mockResolvedValue(targetVersion as any);
      vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue(latestVersion as any);
      vi.mocked(prisma.documentVersion.create).mockResolvedValue({
        ...mockVersion,
        id: 'new-version',
        versionNumber: 4,
        changesSummary: 'Rollback to version 1: Reverting to previous state',
      } as any);
      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any);

      const result = await semanticVersionControlResolvers.Mutation.rollbackToVersion(
        null,
        { input },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.newVersionNumber).toBe(4);
      expect(result.message).toContain('version 1');
    });

    it('should require Associate or Partner role', async () => {
      const paralegalContext = {
        user: { ...mockUser, role: 'Paralegal' as const },
      };

      await expect(
        semanticVersionControlResolvers.Mutation.rollbackToVersion(
          null,
          { input },
          paralegalContext as any
        )
      ).rejects.toThrow('Version control operations require Associate or Partner role');
    });
  });

  describe('Mutation: generateResponseSuggestions', () => {
    const input = {
      changeId: 'change-123',
      partyRole: 'CLIENT',
      language: 'ro',
    };

    it('should generate and store suggestions', async () => {
      const mockChange = {
        id: 'change-123',
        documentId: 'doc-123',
        beforeText: 'Original text',
        afterText: 'Modified text',
        significance: 'SUBSTANTIVE',
        plainSummary: 'Text was modified',
        document: { firmId: 'firm-123', clientId: 'client-123' },
      };

      const aiResponse = {
        suggestions: [
          {
            suggestionType: 'ACCEPT',
            suggestedText: 'We accept this change.',
            reasoning: 'Low risk modification',
          },
          {
            suggestionType: 'COUNTER_PROPOSAL',
            suggestedText: 'Alternative proposal text.',
            reasoning: 'Middle ground suggestion',
          },
        ],
      };

      vi.mocked(prisma.semanticChange.findUnique).mockResolvedValue(mockChange as any);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse),
      } as Response);
      vi.mocked(prisma.responseSuggestion.findMany).mockResolvedValue(
        aiResponse.suggestions.map((s, i) => ({
          id: `suggestion-${i}`,
          changeId: 'change-123',
          ...s,
          language: 'ro',
          createdAt: new Date(),
        })) as any
      );

      const result = await semanticVersionControlResolvers.Mutation.generateResponseSuggestions(
        null,
        { input },
        mockContext
      );

      expect(result.length).toBe(2);
      expect(prisma.responseSuggestion.createMany).toHaveBeenCalled();
    });
  });

  describe('Mutation: dismissSemanticChange', () => {
    it('should mark change as formatting', async () => {
      const mockChange = {
        id: 'change-123',
        significance: 'MINOR_WORDING',
        document: { firmId: 'firm-123' },
      };

      vi.mocked(prisma.semanticChange.findUnique).mockResolvedValue(mockChange as any);
      vi.mocked(prisma.semanticChange.update).mockResolvedValue({
        ...mockChange,
        significance: 'FORMATTING',
      } as any);

      const result = await semanticVersionControlResolvers.Mutation.dismissSemanticChange(
        null,
        { changeId: 'change-123' },
        mockContext
      );

      expect(result.significance).toBe('FORMATTING');
    });

    it('should deny access for changes from other firms', async () => {
      const mockChange = {
        id: 'change-123',
        document: { firmId: 'other-firm' },
      };

      vi.mocked(prisma.semanticChange.findUnique).mockResolvedValue(mockChange as any);

      await expect(
        semanticVersionControlResolvers.Mutation.dismissSemanticChange(
          null,
          { changeId: 'change-123' },
          mockContext
        )
      ).rejects.toThrow('Change not found');
    });
  });
});
