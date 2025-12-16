/**
 * Decision Engine Service Tests
 * Story 2.12.1 - Task 4: Decision Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionEngineService } from './decision-engine.service';
import { DocumentTypeRegistryEntry } from '@shared/types';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    documentTypeRegistry: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    documentTypeInstances: {
      findMany: vi.fn(),
    },
  },
}));

describe('DecisionEngineService', () => {
  let service: DecisionEngineService;
  let mockEntry: DocumentTypeRegistryEntry;

  beforeEach(() => {
    service = new DecisionEngineService();
    vi.clearAllMocks();

    // Default mock entry
    mockEntry = {
      id: 'test-id-123',
      discoveredTypeOriginal: 'Contract de Vanzare-Cumparare',
      discoveredTypeNormalized: 'contract_vanzare_cumparare',
      discoveredTypeEnglish: 'Sales Purchase Agreement',
      primaryLanguage: 'ro',
      documentCategory: 'contract',
      mappedSkillId: 'contract-analysis',
      mappingStatus: 'pending',
      firstSeenDate: new Date('2025-11-15'),
      lastSeenDate: new Date('2025-11-19'),
      totalOccurrences: 25,
      uniqueVariations: 3,
      avgDocumentLength: 5000,
      frequencyScore: 0.55,
      complexityScore: 0.7,
      businessValueScore: 0.75,
      priorityScore: 0.65,
      createdAt: new Date('2025-11-15'),
      updatedAt: new Date('2025-11-19'),
    };
  });

  describe('calculateMappingConfidence', () => {
    it('should calculate high confidence for perfect category-skill match', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.9 },
        { confidence_score: 0.88 },
        { confidence_score: 0.91 },
      ]);

      const entry = {
        ...mockEntry,
        documentCategory: 'contract',
        mappedSkillId: 'contract-analysis',
        totalOccurrences: 100,
        typicalStructure: { structure_type: 'structured' },
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate medium confidence for partial category match', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.7 },
        { confidence_score: 0.65 },
      ]);

      const entry = {
        ...mockEntry,
        documentCategory: 'authorization',
        mappedSkillId: 'contract-analysis',
        totalOccurrences: 20,
        typicalStructure: { structure_type: 'semi-structured' },
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(0.8);
    });

    it('should calculate low confidence for poor category match', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([{ confidence_score: 0.5 }]);

      const entry = {
        ...mockEntry,
        documentCategory: 'unknown',
        mappedSkillId: 'contract-analysis',
        totalOccurrences: 3,
        typicalStructure: { structure_type: 'unstructured' },
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeLessThan(0.6);
    });

    it('should factor in pattern consistency from instance variance', async () => {
      // High variance (low consistency)
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.9 },
        { confidence_score: 0.3 },
        { confidence_score: 0.5 },
      ]);

      const entry = {
        ...mockEntry,
        totalOccurrences: 20,
      };

      const lowConsistencyConfidence = await service.calculateMappingConfidence(entry);

      // Low variance (high consistency)
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.88 },
        { confidence_score: 0.9 },
        { confidence_score: 0.89 },
      ]);

      const highConsistencyConfidence = await service.calculateMappingConfidence(entry);

      expect(highConsistencyConfidence).toBeGreaterThan(lowConsistencyConfidence);
    });
  });

  describe('makeDecision - Auto-mapping', () => {
    it('should auto-map when confidence >80% with sufficient occurrences', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.9 },
        { confidence_score: 0.91 },
        { confidence_score: 0.89 },
      ]);

      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        documentCategory: 'contract',
        mappedSkillId: 'contract-analysis',
        totalOccurrences: 15,
        frequencyScore: 0.6,
        businessValueScore: 0.75,
        typicalStructure: { structure_type: 'structured' },
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('auto_map');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.skillId).toBe('contract-analysis');
      expect(decision.reason).toContain('High mapping confidence');

      // Verify database was updated
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledWith({
        where: { id: entry.id },
        data: expect.objectContaining({
          mapping_status: 'auto_mapped',
          mapped_skill_id: 'contract-analysis',
          mapping_confidence: expect.any(Number),
        }),
      });
    });

    it('should NOT auto-map when confidence is below 80%', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.6 },
        { confidence_score: 0.5 },
      ]);

      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 10,
        documentCategory: 'unknown',
        mappedSkillId: 'document-drafting',
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).not.toBe('auto_map');
    });
  });

  describe('makeDecision - Queue for Review', () => {
    it('should queue for review when occurrences between 20-49', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([{ confidence_score: 0.7 }]);

      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 35,
        frequencyScore: 0.65,
        businessValueScore: 0.6,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('queue_review');
      expect(decision.reason).toContain('20-49');
      expect(decision.reason).toContain('manual review');

      // Verify database update
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledWith({
        where: { id: entry.id },
        data: expect.objectContaining({
          mapping_status: 'queue_review',
        }),
      });
    });

    it('should queue for review at exactly 20 occurrences', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 20,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('queue_review');
    });

    it('should queue for review at exactly 49 occurrences', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 49,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('queue_review');
    });
  });

  describe('makeDecision - Template Creation', () => {
    it('should trigger template creation when ≥50 occurrences with good metrics', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([{ confidence_score: 0.8 }]);

      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 65,
        frequencyScore: 0.85,
        businessValueScore: 0.8,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('create_template');
      expect(decision.reason).toContain('50');
      expect(decision.reason).toContain('template creation threshold');

      // Verify database update
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledWith({
        where: { id: entry.id },
        data: expect.objectContaining({
          mapping_status: 'template_pending',
        }),
      });
    });

    it('should NOT create template if frequency score too low', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 55,
        frequencyScore: 0.4, // Below 0.50 threshold
        businessValueScore: 0.8,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).not.toBe('create_template');
    });

    it('should NOT create template if business value too low', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 55,
        frequencyScore: 0.85,
        businessValueScore: 0.4, // Below 0.50 threshold
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).not.toBe('create_template');
    });
  });

  describe('makeDecision - No Action', () => {
    it('should take no action for low occurrences', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 3,
        frequencyScore: 0.2,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.action).toBe('no_action');
      expect(decision.reason).toContain('Insufficient data');
    });
  });

  describe('Manual Override', () => {
    it('should apply manual override and record audit trail', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 5,
      };

      const override = {
        action: 'auto_map',
        skillId: 'legal-research',
        userId: 'admin-user-123',
      };

      const decision = await service.makeDecision(entry, override);

      expect(decision.action).toBe('auto_map');
      expect(decision.skillId).toBe('legal-research');
      expect(decision.reason).toBe('Manual override by administrator');
      expect(decision.auditInfo.decidedBy).toBe('admin-user-123');
      expect(decision.auditInfo.decisionBasis).toBe('manual_override');

      // Verify audit trail in database
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledWith({
        where: { id: entry.id },
        data: expect.objectContaining({
          reviewed_by: 'admin-user-123',
          reviewed_at: expect.any(Date),
        }),
      });
    });
  });

  describe('Audit Trail', () => {
    it('should record system decision in audit trail', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 30,
      };

      const decision = await service.makeDecision(entry);

      expect(decision.auditInfo.decidedBy).toBe('system');
      expect(decision.auditInfo.decidedAt).toBeInstanceOf(Date);
      expect(decision.auditInfo.decisionBasis).toBeTruthy();

      // Verify database update includes audit fields
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledWith({
        where: { id: entry.id },
        data: expect.objectContaining({
          reviewed_by: 'system',
          reviewed_at: expect.any(Date),
        }),
      });
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple pending entries', async () => {
      const mockPendingEntries = [
        {
          id: '1',
          discovered_type_normalized: 'contract',
          total_occurrences: 60,
          mapping_status: 'pending',
          frequency_score: 0.85,
          business_value_score: 0.8,
        },
        {
          id: '2',
          discovered_type_normalized: 'notice',
          total_occurrences: 25,
          mapping_status: 'pending',
          frequency_score: 0.55,
          business_value_score: 0.6,
        },
        {
          id: '3',
          discovered_type_normalized: 'memo',
          total_occurrences: 3,
          mapping_status: 'pending',
          frequency_score: 0.1,
          business_value_score: 0.3,
        },
      ];

      (prisma.documentTypeRegistry.findMany as any).mockResolvedValue(mockPendingEntries);
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const result = await service.processPendingEntries();

      expect(result.processed).toBe(3);
      expect(result.templatesQueued).toBeGreaterThanOrEqual(1); // Entry 1
      expect(result.queuedForReview).toBeGreaterThanOrEqual(1); // Entry 2
      expect(prisma.documentTypeRegistry.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing category gracefully', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        documentCategory: undefined,
        totalOccurrences: 10,
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should handle missing skill ID gracefully', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        mappedSkillId: undefined,
        totalOccurrences: 10,
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should handle zero occurrences instances', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 5,
      };

      const confidence = await service.calculateMappingConfidence(entry);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Priority Decision Making', () => {
    it('should prioritize template creation over auto-mapping when both thresholds met', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.95 },
        { confidence_score: 0.94 },
      ]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 55,
        frequencyScore: 0.85,
        businessValueScore: 0.8,
        documentCategory: 'contract',
        mappedSkillId: 'contract-analysis',
        typicalStructure: { structure_type: 'structured' },
      };

      const decision = await service.makeDecision(entry);

      // Template creation should take priority
      expect(decision.action).toBe('create_template');
    });

    it('should prioritize auto-mapping over queue when confidence very high', async () => {
      (prisma.documentTypeInstances.findMany as any).mockResolvedValue([
        { confidence_score: 0.95 },
        { confidence_score: 0.94 },
        { confidence_score: 0.96 },
      ]);
      (prisma.documentTypeRegistry.update as any).mockResolvedValue({});

      const entry = {
        ...mockEntry,
        totalOccurrences: 22, // In queue range (20-49)
        documentCategory: 'contract',
        mappedSkillId: 'contract-analysis',
        typicalStructure: { structure_type: 'structured' },
        frequencyScore: 0.6,
        businessValueScore: 0.7,
      };

      const decision = await service.makeDecision(entry);

      // With very high confidence, should auto-map instead of queue
      expect(decision.action).toBe('auto_map');
    });
  });
});
