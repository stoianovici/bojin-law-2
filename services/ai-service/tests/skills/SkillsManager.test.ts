/**
 * Unit Tests for SkillsManager
 */

import { SkillsManager } from '../../src/skills/SkillsManager';
import { SkillsAPIClient } from '../../src/skills/SkillsAPIClient';
import type { UploadSkillPayload, SkillMetadata, Skill } from '../../src/types/skills';

// Mock SkillsAPIClient
jest.mock('../../src/skills/SkillsAPIClient');

describe('SkillsManager', () => {
  let manager: SkillsManager;
  let mockApiClient: jest.Mocked<SkillsAPIClient>;

  beforeEach(() => {
    mockApiClient = new SkillsAPIClient({
      apiKey: 'test-key',
    }) as jest.Mocked<SkillsAPIClient>;

    manager = new SkillsManager(mockApiClient, {
      cacheTTL: 3600,
      maxCacheSize: 10,
    });

    jest.clearAllMocks();
  });

  describe('uploadSkill', () => {
    const validPayload: UploadSkillPayload = {
      display_name: 'Test Skill',
      description: 'A valid test skill',
      type: 'analysis',
      category: 'legal-analysis',
      content: 'Valid content',
      version: '1.0.0',
    };

    const mockMetadata: SkillMetadata = {
      id: '123',
      skill_id: 'skill-123',
      display_name: 'Test Skill',
      description: 'A valid test skill',
      version: '1.0.0',
      type: 'analysis',
      category: 'legal-analysis',
      effectiveness_score: 0,
      token_savings_avg: 0,
      usage_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should upload a valid skill', async () => {
      mockApiClient.uploadSkill.mockResolvedValueOnce(mockMetadata);

      const result = await manager.uploadSkill(validPayload);

      expect(result).toEqual(mockMetadata);
      expect(mockApiClient.uploadSkill).toHaveBeenCalledWith(validPayload);
    });

    it('should throw validation error for missing display_name', async () => {
      const invalidPayload = { ...validPayload, display_name: '' };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['Display name is required']),
      });
    });

    it('should throw validation error for missing description', async () => {
      const invalidPayload = { ...validPayload, description: '' };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['Description is required']),
      });
    });

    it('should throw validation error for missing content', async () => {
      const invalidPayload = { ...validPayload, content: '' };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['Content is required']),
      });
    });

    it('should throw validation error for content exceeding max size', async () => {
      const invalidPayload = {
        ...validPayload,
        content: 'x'.repeat(1_000_001), // Exceeds 1MB
      };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['Content exceeds maximum size of 1MB']),
      });
    });

    it('should throw validation error for invalid version format', async () => {
      const invalidPayload = { ...validPayload, version: '1.0' };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining([
          'Version must follow semver format (e.g., 1.0.0)',
        ]),
      });
    });

    it('should throw validation error for invalid config max_tokens', async () => {
      const invalidPayload = {
        ...validPayload,
        config: { max_tokens: 300000 }, // Exceeds max
      };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['max_tokens must be between 1 and 200000']),
      });
    });

    it('should throw validation error for invalid config temperature', async () => {
      const invalidPayload = {
        ...validPayload,
        config: { temperature: 1.5 }, // Exceeds max
      };

      await expect(manager.uploadSkill(invalidPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        validationErrors: expect.arrayContaining(['temperature must be between 0 and 1']),
      });
    });

    it('should detect dangerous patterns in content', async () => {
      const dangerousPayload = {
        ...validPayload,
        content: 'This contains eval() function',
      };

      await expect(manager.uploadSkill(dangerousPayload)).rejects.toMatchObject({
        name: 'SkillValidationError',
        message: 'Content validation failed',
      });
    });
  });

  describe('getSkill with caching', () => {
    const mockSkill: Skill = {
      id: '123',
      skill_id: 'skill-123',
      display_name: 'Test Skill',
      description: 'A test skill',
      version: '1.0.0',
      type: 'analysis',
      category: 'legal-analysis',
      effectiveness_score: 0.8,
      token_savings_avg: 500,
      usage_count: 5,
      content: 'Skill content',
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should fetch skill from API on first call', async () => {
      mockApiClient.getSkill.mockResolvedValueOnce(mockSkill);

      const result = await manager.getSkill('skill-123');

      expect(result).toEqual(mockSkill);
      expect(mockApiClient.getSkill).toHaveBeenCalledTimes(1);
    });

    it('should return cached skill on second call', async () => {
      mockApiClient.getSkill.mockResolvedValueOnce(mockSkill);

      // First call - should fetch from API
      await manager.getSkill('skill-123');

      // Second call - should use cache
      const result = await manager.getSkill('skill-123');

      expect(result).toEqual(mockSkill);
      expect(mockApiClient.getSkill).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should bypass cache when useCache is false', async () => {
      mockApiClient.getSkill.mockResolvedValue(mockSkill);

      await manager.getSkill('skill-123', false);
      await manager.getSkill('skill-123', false);

      expect(mockApiClient.getSkill).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateSkill', () => {
    const mockUpdatedSkill: Skill = {
      id: '123',
      skill_id: 'skill-123',
      display_name: 'Updated Skill',
      description: 'Updated',
      version: '1.0.0',
      type: 'analysis',
      category: 'legal-analysis',
      effectiveness_score: 0.8,
      token_savings_avg: 500,
      usage_count: 5,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update skill and invalidate cache', async () => {
      mockApiClient.updateSkill.mockResolvedValueOnce(mockUpdatedSkill);

      const result = await manager.updateSkill('skill-123', {
        display_name: 'Updated Skill',
      });

      expect(result).toEqual(mockUpdatedSkill);
      expect(mockApiClient.updateSkill).toHaveBeenCalledWith('skill-123', {
        display_name: 'Updated Skill',
      });
    });

    it('should validate content if provided in updates', async () => {
      await expect(
        manager.updateSkill('skill-123', {
          content: 'exec() is dangerous',
        })
      ).rejects.toMatchObject({
        name: 'SkillValidationError',
      });
    });
  });

  describe('deleteSkill', () => {
    it('should delete skill and remove from cache', async () => {
      mockApiClient.deleteSkill.mockResolvedValueOnce();

      await manager.deleteSkill('skill-123');

      expect(mockApiClient.deleteSkill).toHaveBeenCalledWith('skill-123');
    });
  });

  describe('generateSkillFromTemplate', () => {
    it('should generate skill from legal-analysis template', () => {
      const result = manager.generateSkillFromTemplate('legal-analysis', {
        display_name: 'Contract Analysis',
        description: 'Analyze contracts',
        document_type: 'Contract',
        analysis_focus: 'Terms and conditions',
        output_format: 'Markdown',
      });

      expect(result.display_name).toBe('Contract Analysis');
      expect(result.type).toBe('analysis');
      expect(result.category).toBe('legal-analysis');
      expect(result.content).toContain('Contract');
    });

    it('should generate skill from document-extraction template', () => {
      const result = manager.generateSkillFromTemplate('document-extraction', {
        display_name: 'Extract Data',
        description: 'Extract key data',
        data_type: 'dates',
        document_type: 'Invoice',
        field_1: 'Date',
        field_2: 'Amount',
        field_3: 'Vendor',
      });

      expect(result.type).toBe('extraction');
      expect(result.category).toBe('document-processing');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        manager.generateSkillFromTemplate('nonexistent', {});
      }).toThrow('Template not found: nonexistent');
    });
  });

  describe('cache management', () => {
    it('should report cache stats', () => {
      const stats = manager.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('entries');
    });

    it('should clear all cache', () => {
      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('trackSkillEffectiveness', () => {
    it('should log effectiveness metrics', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await manager.trackSkillEffectiveness('skill-123', 500, 1200, true);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tracking effectiveness'),
        expect.objectContaining({
          tokensSaved: 500,
          executionTime: 1200,
          success: true,
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
