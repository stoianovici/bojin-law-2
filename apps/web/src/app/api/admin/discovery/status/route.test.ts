/**
 * Discovery Status API Tests
 * Story 2.12.1 - Task 7: Admin Dashboard
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock the discovery status service
jest.mock('@/lib/services/discovery-status.service', () => ({
  discoveryStatusService: {
    getStatus: jest.fn(),
    getDocumentTypes: jest.fn(),
    getPendingReview: jest.fn(),
    getDiscoveryTrends: jest.fn(),
  },
}));

import { discoveryStatusService } from '@/lib/services/discovery-status.service';

describe('Discovery Status API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/discovery/status', () => {
    it('should return basic status when detailed=false', async () => {
      const mockStatus = {
        typesDiscovered: 47,
        pendingReview: 12,
        templatesCreated: 5,
        estimatedROI: '€2500/month',
        totalDocuments: 150,
        mappedToSkills: 20,
        averageConfidence: 0.85,
      };

      (discoveryStatusService.getStatus as jest.Mock).mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockStatus);
      expect(discoveryStatusService.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should return detailed status when detailed=true', async () => {
      const mockStatus = {
        typesDiscovered: 47,
        pendingReview: 12,
        templatesCreated: 5,
        estimatedROI: '€2500/month',
        totalDocuments: 150,
        mappedToSkills: 20,
        averageConfidence: 0.85,
      };

      const mockDocumentTypes = [
        {
          id: '123',
          discoveredTypeOriginal: 'Contract de Vanzare',
          totalOccurrences: 50,
        },
      ];

      const mockPendingReview = [
        {
          id: '456',
          discoveredTypeOriginal: 'Somatie',
          totalOccurrences: 25,
        },
      ];

      const mockTrends = [
        {
          date: '2025-11-19',
          typesDiscovered: 5,
          documentsProcessed: 20,
        },
      ];

      (discoveryStatusService.getStatus as jest.Mock).mockResolvedValue(mockStatus);
      (discoveryStatusService.getDocumentTypes as jest.Mock).mockResolvedValue(mockDocumentTypes);
      (discoveryStatusService.getPendingReview as jest.Mock).mockResolvedValue(mockPendingReview);
      (discoveryStatusService.getDiscoveryTrends as jest.Mock).mockResolvedValue(mockTrends);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/discovery/status?detailed=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        ...mockStatus,
        documentTypes: mockDocumentTypes,
        pendingReview: mockPendingReview,
        trends: mockTrends,
      });
    });

    it('should respect limit and offset parameters', async () => {
      const mockStatus = {
        typesDiscovered: 100,
        pendingReview: 0,
        templatesCreated: 10,
        estimatedROI: '€5000/month',
        totalDocuments: 500,
        mappedToSkills: 50,
        averageConfidence: 0.9,
      };

      (discoveryStatusService.getStatus as jest.Mock).mockResolvedValue(mockStatus);
      (discoveryStatusService.getDocumentTypes as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/discovery/status?detailed=true&limit=10&offset=20'
      );
      await GET(request);

      expect(discoveryStatusService.getDocumentTypes).toHaveBeenCalledWith(10, 20, 'priority');
    });

    it('should respect sortBy parameter', async () => {
      const mockStatus = {
        typesDiscovered: 100,
        pendingReview: 0,
        templatesCreated: 10,
        estimatedROI: '€5000/month',
        totalDocuments: 500,
        mappedToSkills: 50,
        averageConfidence: 0.9,
      };

      (discoveryStatusService.getStatus as jest.Mock).mockResolvedValue(mockStatus);
      (discoveryStatusService.getDocumentTypes as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/discovery/status?detailed=true&sortBy=occurrences'
      );
      await GET(request);

      expect(discoveryStatusService.getDocumentTypes).toHaveBeenCalledWith(50, 0, 'occurrences');
    });

    it('should handle service errors gracefully', async () => {
      (discoveryStatusService.getStatus as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch discovery status');
      expect(data.details).toBe('Database connection failed');
    });
  });
});
