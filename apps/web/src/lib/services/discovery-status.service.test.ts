/**
 * Discovery Status Service Tests
 * Story 2.12.1 - Task 7: Admin Dashboard
 * Story 2.15: Refactored with Dependency Injection
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { DatabaseClient } from '@legal-platform/types';
import { DiscoveryStatusService } from './discovery-status.service';

describe('DiscoveryStatusService', () => {
  let service: DiscoveryStatusService;
  let mockDb: DatabaseClient;

  beforeEach(() => {
    // Create mock database client
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      getClient: jest.fn(),
      closePool: jest.fn(),
    };

    // Inject mock database client into service
    service = new DiscoveryStatusService(mockDb);
  });

  describe('getStatus', () => {
    it('should return discovery status summary', async () => {
      const mockStats = {
        typesDiscovered: '47',
        pendingReview: '12',
        templatesCreated: '5',
        totalDocuments: '150',
        mappedToSkills: '20',
        averageConfidence: '0.85',
      };

      const mockROI = {
        totalSavings: 30000,
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [mockROI] });

      const result = await service.getStatus();

      expect(result).toEqual({
        typesDiscovered: 47,
        pendingReview: 12,
        templatesCreated: 5,
        estimatedROI: '€30000/month',
        totalDocuments: 150,
        mappedToSkills: 20,
        averageConfidence: 0.85,
      });
    });

    it('should handle null ROI gracefully', async () => {
      const mockStats = {
        typesDiscovered: '10',
        pendingReview: '5',
        templatesCreated: '0',
        totalDocuments: '50',
        mappedToSkills: '5',
        averageConfidence: '0.70',
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [{ totalSavings: null }] });

      const result = await service.getStatus();

      expect(result.estimatedROI).toBe('€0/month');
    });
  });

  describe('getDocumentTypes', () => {
    it('should return document types with default sorting', async () => {
      const mockTypes = [
        {
          id: '123',
          discoveredTypeOriginal: 'Contract de Vanzare',
          discoveredTypeNormalized: 'contract_vanzare',
          discoveredTypeEnglish: 'Sales Contract',
          primaryLanguage: 'ro',
          mappedSkillId: 'document-drafting',
          totalOccurrences: 50,
          priorityScore: 0.85,
          mappingStatus: 'mapped',
          confidence: 0.90,
          lastDiscovered: new Date('2025-11-19'),
          estimatedTimeSavings: 2.5,
          estimatedMonthlySavings: '€1042/month',
        },
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: mockTypes });

      const result = await service.getDocumentTypes();

      expect(result).toEqual(mockTypes);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY priority_score DESC NULLS LAST'),
        [50, 0]
      );
    });

    it('should support sorting by occurrences', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getDocumentTypes(25, 10, 'occurrences');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_occurrences DESC'),
        [25, 10]
      );
    });

    it('should support sorting by recent', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getDocumentTypes(100, 0, 'recent');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_discovered_at DESC'),
        [100, 0]
      );
    });

    it('should respect limit and offset', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getDocumentTypes(10, 20);

      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), [10, 20]);
    });
  });

  describe('getPendingReview', () => {
    it('should return only pending review items', async () => {
      const mockPending = [
        {
          id: '456',
          discoveredTypeOriginal: 'Somatie',
          mappingStatus: 'pending_review',
          totalOccurrences: 25,
        },
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: mockPending });

      const result = await service.getPendingReview();

      expect(result).toEqual(mockPending);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE mapping_status = 'pending_review'")
      );
    });
  });

  describe('getSampleDocuments', () => {
    it('should return sample document IDs for a type', async () => {
      const mockSamples = {
        sample_document_ids: ['doc1', 'doc2', 'doc3'],
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [mockSamples] });

      const result = await service.getSampleDocuments('123');

      expect(result).toEqual(['doc1', 'doc2', 'doc3']);
      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), ['123']);
    });

    it('should return empty array if no samples found', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getSampleDocuments('999');

      expect(result).toEqual([]);
    });
  });

  describe('mapTypeToSkill', () => {
    it('should update document type mapping', async () => {
      const mappingRequest = {
        typeId: '123',
        targetSkill: 'document-drafting',
        confidence: 0.95,
        reviewedBy: 'John Doe',
        decisionBasis: 'Manual review',
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.mapTypeToSkill(mappingRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE document_type_registry'),
        [
          'document-drafting',
          0.95,
          'John Doe',
          'Manual review',
          '123',
        ]
      );
    });
  });

  describe('triggerTemplateGeneration', () => {
    it('should mark template as created', async () => {
      const generationRequest = {
        typeId: '123',
        language: 'ro',
        includeEnglish: true,
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.triggerTemplateGeneration(generationRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('template_created = true'),
        ['ro', true, '123']
      );
    });
  });

  describe('getROICalculation', () => {
    it('should calculate ROI for selected types', async () => {
      const mockData = {
        totalHoursSaved: '100',
        totalDocuments: '200',
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [mockData] });

      const result = await service.getROICalculation(['123', '456']);

      expect(result).toEqual({
        timesSaved: 100 * 200,
        monthlySavings: (100 * 200 * 100) / 12,
        annualSavings: 100 * 200 * 100,
      });
    });

    it('should handle zero values', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ totalHoursSaved: '0', totalDocuments: '0' }],
      });

      const result = await service.getROICalculation(['999']);

      expect(result.timesSaved).toBe(0);
      expect(result.monthlySavings).toBe(0);
      expect(result.annualSavings).toBe(0);
    });
  });

  describe('getDiscoveryTrends', () => {
    it('should return trends for specified days', async () => {
      const mockTrends = [
        {
          date: '2025-11-19',
          typesDiscovered: 5,
          documentsProcessed: 20,
        },
        {
          date: '2025-11-18',
          typesDiscovered: 3,
          documentsProcessed: 15,
        },
      ];

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: mockTrends });

      const result = await service.getDiscoveryTrends(7);

      expect(result).toEqual(mockTrends);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
    });

    it('should default to 30 days', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getDiscoveryTrends();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'")
      );
    });
  });
});
