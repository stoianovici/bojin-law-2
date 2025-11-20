/**
 * Template Generation API Tests
 * Story 2.12.1 - Task 7: Admin Dashboard
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the discovery status service
jest.mock('@/lib/services/discovery-status.service', () => ({
  discoveryStatusService: {
    triggerTemplateGeneration: jest.fn(),
  },
}));

import { discoveryStatusService } from '@/lib/services/discovery-status.service';

describe('Template Generation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/templates/generate', () => {
    it('should trigger template generation successfully', async () => {
      const generationRequest = {
        typeId: '123-456-789',
        language: 'ro',
        includeEnglish: true,
      };

      (discoveryStatusService.triggerTemplateGeneration as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(generationRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.template).toEqual({
        typeId: generationRequest.typeId,
        language: generationRequest.language,
        includeEnglish: generationRequest.includeEnglish,
      });
      expect(discoveryStatusService.triggerTemplateGeneration).toHaveBeenCalledWith(
        generationRequest
      );
    });

    it('should return 400 if typeId is missing', async () => {
      const invalidRequest = {
        language: 'ro',
        includeEnglish: true,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Type ID is required');
    });

    it('should return 400 if language is missing', async () => {
      const invalidRequest = {
        typeId: '123',
        includeEnglish: true,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Language is required');
    });

    it('should return 400 if includeEnglish is not boolean', async () => {
      const invalidRequest = {
        typeId: '123',
        language: 'ro',
        includeEnglish: 'yes', // Should be boolean
      };

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('includeEnglish must be a boolean');
    });

    it('should handle includeEnglish=false', async () => {
      const generationRequest = {
        typeId: '123',
        language: 'ro',
        includeEnglish: false,
      };

      (discoveryStatusService.triggerTemplateGeneration as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(generationRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(discoveryStatusService.triggerTemplateGeneration).toHaveBeenCalledWith(
        generationRequest
      );
    });

    it('should handle service errors gracefully', async () => {
      const generationRequest = {
        typeId: '123',
        language: 'ro',
        includeEnglish: true,
      };

      (discoveryStatusService.triggerTemplateGeneration as jest.Mock).mockRejectedValue(
        new Error('Template creation failed')
      );

      const request = new NextRequest('http://localhost:3000/api/admin/templates/generate', {
        method: 'POST',
        body: JSON.stringify(generationRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to trigger template generation');
      expect(data.details).toBe('Template creation failed');
    });
  });
});
