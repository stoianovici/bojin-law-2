/**
 * Manual Mapping API Tests
 * Story 2.12.1 - Task 7: Admin Dashboard
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the discovery status service
jest.mock('@/lib/services/discovery-status.service', () => ({
  discoveryStatusService: {
    mapTypeToSkill: jest.fn(),
  },
}));

import { discoveryStatusService } from '@/lib/services/discovery-status.service';

describe('Manual Mapping API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/discovery/map', () => {
    it('should map document type successfully', async () => {
      const mappingRequest = {
        typeId: '123-456-789',
        targetSkill: 'document-drafting',
        confidence: 0.95,
        reviewedBy: 'John Doe',
        decisionBasis: 'Manual review of samples',
      };

      (discoveryStatusService.mapTypeToSkill as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(mappingRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.mapping).toEqual({
        typeId: mappingRequest.typeId,
        skillId: mappingRequest.targetSkill,
        confidence: mappingRequest.confidence,
      });
      expect(discoveryStatusService.mapTypeToSkill).toHaveBeenCalledWith(mappingRequest);
    });

    it('should return 400 if typeId is missing', async () => {
      const invalidRequest = {
        targetSkill: 'document-drafting',
        confidence: 0.95,
        reviewedBy: 'John Doe',
        decisionBasis: 'Test',
      };

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Type ID is required');
    });

    it('should return 400 if targetSkill is missing', async () => {
      const invalidRequest = {
        typeId: '123',
        confidence: 0.95,
        reviewedBy: 'John Doe',
        decisionBasis: 'Test',
      };

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Target skill is required');
    });

    it('should return 400 if confidence is invalid', async () => {
      const invalidRequest = {
        typeId: '123',
        targetSkill: 'document-drafting',
        confidence: 1.5, // Invalid: > 1
        reviewedBy: 'John Doe',
        decisionBasis: 'Test',
      };

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Confidence must be a number between 0 and 1');
    });

    it('should return 400 if reviewedBy is missing', async () => {
      const invalidRequest = {
        typeId: '123',
        targetSkill: 'document-drafting',
        confidence: 0.95,
        decisionBasis: 'Test',
      };

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Reviewed by is required');
    });

    it('should handle service errors gracefully', async () => {
      const mappingRequest = {
        typeId: '123',
        targetSkill: 'document-drafting',
        confidence: 0.95,
        reviewedBy: 'John Doe',
        decisionBasis: 'Test',
      };

      (discoveryStatusService.mapTypeToSkill as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/admin/discovery/map', {
        method: 'POST',
        body: JSON.stringify(mappingRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to map document type');
      expect(data.details).toBe('Database error');
    });
  });
});
