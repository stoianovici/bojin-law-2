/**
 * Template Usage Tracking Service Tests
 * Story 2.12.1 - AC6
 * Story 2.15: Refactored with Dependency Injection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { DatabaseClient } from '@legal-platform/types';
import { TemplateUsageTrackingService } from './template-usage-tracking.service';

describe('TemplateUsageTrackingService', () => {
  let service: TemplateUsageTrackingService;
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
    service = new TemplateUsageTrackingService(mockDb);
  });

  describe('trackUsage', () => {
    it('should insert usage log into database', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.trackUsage({
        template_id: 'template-123',
        user_id: 'user-456',
        execution_time_ms: 5000,
        time_saved_minutes: 45,
        variables_provided: { NAME: 'John Doe' },
        output_format: 'markdown',
        success: true,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO template_usage_logs'),
        expect.arrayContaining(['template-123', 'user-456', 5000, 45])
      );
    });

    it('should handle optional fields', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.trackUsage({
        template_id: 'template-123',
        variables_provided: {},
        success: false,
        error_message: 'Validation failed',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'template-123',
          null, // user_id
          null, // execution_time_ms
          null, // time_saved_minutes
        ])
      );
    });
  });

  describe('measureTimeSaved', () => {
    it('should calculate time saved based on template complexity', async () => {
      // Mock template metadata
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-123',
            template_name_ro: 'Test Template',
            variable_mappings: {
              complexity: 'high',
              averageLength: 3,
            },
          },
        ],
      });

      const startTime = new Date('2025-11-19T10:00:00Z');
      const endTime = new Date('2025-11-19T10:10:00Z'); // 10 minutes later

      const timeSaved = await service.measureTimeSaved('template-123', startTime, endTime);

      // High complexity, 3 pages = 3 * 30 = 90 minutes base time
      // Actual time = 10 minutes
      // Saved = 90 - 10 = 80 minutes
      expect(timeSaved).toBe(80);
    });

    it('should return 0 if template not found', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const timeSaved = await service.measureTimeSaved('invalid-template', new Date(), new Date());

      expect(timeSaved).toBe(0);
    });
  });

  describe('calculateROI', () => {
    it('should calculate ROI based on actual usage data', async () => {
      // Mock template metadata
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-123',
            template_name_ro: 'Notificare Avocateasca',
            template_name_en: 'Legal Notice',
            avg_time_savings_minutes: 60,
          },
        ],
      });

      // Mock usage statistics
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '10',
            success_count: '9',
            avg_time_saved: '55',
            total_time_saved: '550',
            last_used: new Date(),
          },
        ],
      });

      const roi = await service.calculateROI('template-123', 30);

      expect(roi.templateId).toBe('template-123');
      expect(roi.actualROI).toBeGreaterThan(0);
      expect(roi.estimatedROI).toBeGreaterThan(0);
      expect(roi.totalValueGenerated).toBeGreaterThan(0);
      expect(roi.netValue).toBeDefined();
    });

    it('should calculate variance between actual and estimated ROI', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-123',
            template_name_ro: 'Test',
            template_name_en: 'Test',
            avg_time_savings_minutes: 60,
          },
        ],
      });

      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '10',
            success_count: '10',
            avg_time_saved: '90', // Higher than estimated
            total_time_saved: '900',
            last_used: new Date(),
          },
        ],
      });

      const roi = await service.calculateROI('template-123', 30);

      // Variance should be positive since actual > estimated
      expect(roi.variance).toBeGreaterThan(0);
    });

    it('should throw error for non-existent template', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.calculateROI('invalid-template', 30)).rejects.toThrow(
        'Template not found'
      );
    });
  });

  describe('identifyTemplatesNeedingUpdates', () => {
    it('should identify low usage templates', async () => {
      // Mock all templates
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-1',
            template_name_ro: 'Low Usage Template',
          },
          {
            id: 'template-2',
            template_name_ro: 'Popular Template',
          },
        ],
      });

      // Mock usage stats for template-1 (low usage)
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '2',
            success_count: '2',
            avg_time_saved: '30',
            total_time_saved: '60',
            last_used: new Date(),
          },
        ],
      });

      // Mock usage stats for template-2 (high usage)
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '50',
            success_count: '48',
            avg_time_saved: '45',
            total_time_saved: '2250',
            last_used: new Date(),
          },
        ],
      });

      const needsUpdate = await service.identifyTemplatesNeedingUpdates();

      const lowUsage = needsUpdate.find((t) => t.reason === 'low_usage');
      expect(lowUsage).toBeDefined();
      expect(lowUsage?.metrics.usageCount).toBeLessThan(5);
    });

    it('should identify high failure rate templates', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'template-1', template_name_ro: 'Problematic Template' }],
      });

      // 10 uses but only 5 successful (50% success rate)
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '10',
            success_count: '5',
            avg_time_saved: '30',
            total_time_saved: '300',
            last_used: new Date(),
          },
        ],
      });

      const needsUpdate = await service.identifyTemplatesNeedingUpdates();

      const highFailure = needsUpdate.find((t) => t.reason === 'high_failure_rate');
      expect(highFailure).toBeDefined();
      expect(highFailure?.priority).toBe('high');
      expect(highFailure?.metrics.successRate).toBeLessThan(70);
    });

    it('should identify outdated templates', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'template-1', template_name_ro: 'Old Template' }],
      });

      const sixtyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);

      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            total_uses: '5',
            success_count: '5',
            avg_time_saved: '30',
            total_time_saved: '150',
            last_used: sixtyDaysAgo,
          },
        ],
      });

      const needsUpdate = await service.identifyTemplatesNeedingUpdates();

      const outdated = needsUpdate.find((t) => t.reason === 'outdated');
      expect(outdated).toBeDefined();
      expect(outdated?.metrics.daysSinceLastUse).toBeGreaterThan(60);
    });
  });

  describe('generateEffectivenessReport', () => {
    it('should generate comprehensive effectiveness report', async () => {
      const startDate = new Date('2025-11-01');
      const endDate = new Date('2025-11-30');

      // Mock usage data
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            template_id: 'template-1',
            total_uses: '25',
            success_count: '24',
            total_time_saved: '1200',
          },
          {
            template_id: 'template-2',
            total_uses: '15',
            success_count: '14',
            total_time_saved: '800',
          },
        ],
      });

      // Mock all templates
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-1',
            template_name_ro: 'Template 1',
          },
          {
            id: 'template-2',
            template_name_ro: 'Template 2',
          },
        ],
      });

      // Mock templates needing updates
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const report = await service.generateEffectivenessReport(startDate, endDate);

      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.totalTemplates).toBe(2);
      expect(report.totalUsages).toBe(40);
      expect(report.totalTimeSaved).toBe(2000);
      expect(report.averageSuccessRate).toBeGreaterThan(0);
      expect(report.topPerformers.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide actionable recommendations', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            template_id: 'template-1',
            total_uses: '100',
            success_count: '95',
            total_time_saved: '5000', // 83 hours saved!
          },
        ],
      });

      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'template-1', template_name_ro: 'High Value Template' }],
      });

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const report = await service.generateEffectivenessReport(
        new Date('2025-11-01'),
        new Date('2025-11-30')
      );

      // Check that at least one recommendation matches the pattern
      const hasMatchingRecommendation = report.recommendations.some((rec) =>
        /high-value|excellent ROI/i.test(rec)
      );
      expect(hasMatchingRecommendation).toBe(true);
    });
  });

  describe('queueForReview', () => {
    it('should add template to review queue', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const template: any = {
        templateId: 'template-123',
        templateName: 'Test Template',
        reason: 'low_usage',
        priority: 'medium',
        metrics: {
          usageCount: 2,
          successRate: 100,
          daysSinceLastUse: 30,
        },
      };

      await service.queueForReview(template);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE romanian_templates'),
        expect.arrayContaining(['template-123', expect.any(String)])
      );
    });
  });

  describe('getReviewQueue', () => {
    it('should retrieve all templates in review queue', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'template-1',
            template_name_ro: 'Template 1',
            template_name_en: 'Template 1 EN',
            review_queue: {
              queuedAt: '2025-11-19',
              reason: 'low_usage',
              priority: 'medium',
              metrics: { usageCount: 2, successRate: 100, daysSinceLastUse: 30 },
            },
          },
        ],
      });

      const queue = await service.getReviewQueue();

      expect(queue.length).toBe(1);
      expect(queue[0].templateId).toBe('template-1');
      expect(queue[0].reason).toBe('low_usage');
      expect(queue[0].priority).toBe('medium');
    });
  });
});
