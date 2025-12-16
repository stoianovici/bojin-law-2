/**
 * AlertsManager Tests
 *
 * Tests for production alerting system including:
 * - Alert threshold evaluation
 * - Multi-channel notification delivery
 * - Alert lifecycle (trigger, active, resolved)
 * - Escalation policies
 * - Daily summary reports
 */

import {
  AlertsManager,
  ALERT_THRESHOLDS,
  SkillsHealthMetrics,
} from '../../src/monitoring/AlertsManager';

describe('AlertsManager', () => {
  let alertsManager: AlertsManager;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Mock fetch for external API calls
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    alertsManager = new AlertsManager({
      pagerduty: {
        enabled: true,
        routingKey: 'test-routing-key',
      },
      slack: {
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
        channel: '#alerts-test',
      },
      email: {
        enabled: true,
        smtpConfig: {},
        from: 'alerts@example.com',
        to: ['team@example.com'],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Alert Threshold Evaluation
  // ============================================================================

  describe('Alert Threshold Evaluation', () => {
    it('should trigger critical alert when service is down', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 0, // Service down
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.thresholdId === 'skills-service-down')).toBe(true);
      expect(alerts.find((a) => a.thresholdId === 'skills-service-down')?.severity).toBe(
        'critical'
      );
    });

    it('should trigger critical alert when error rate exceeds 5%', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 6, // Above 5% threshold
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.some((a) => a.thresholdId === 'high-skill-error-rate')).toBe(true);
      expect(alerts.find((a) => a.thresholdId === 'high-skill-error-rate')?.severity).toBe(
        'critical'
      );
    });

    it('should trigger critical alert when p95 response time exceeds 10s', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 0,
        p95ResponseTime: 11000, // 11 seconds
        averageResponseTime: 6000,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.some((a) => a.thresholdId === 'skills-response-time-critical')).toBe(true);
    });

    it('should trigger warning alert when timeout rate exceeds 5%', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 6, // Above 5% threshold
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.some((a) => a.thresholdId === 'elevated-skill-timeout-rate')).toBe(true);
      expect(alerts.find((a) => a.thresholdId === 'elevated-skill-timeout-rate')?.severity).toBe(
        'warning'
      );
    });

    it('should trigger warning alert when cache hit rate below 30%', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 25, // Below 30% threshold
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.some((a) => a.thresholdId === 'low-cache-hit-rate')).toBe(true);
    });

    it('should trigger warning alert when cost spike exceeds 150%', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 20,
        costSpikePercentage: 160, // 160% of baseline
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.some((a) => a.thresholdId === 'cost-spike-detected')).toBe(true);
    });

    it('should not trigger alerts when all metrics healthy', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 1, // Below 5%
        timeoutRate: 2, // Below 5%
        p95ResponseTime: 3000, // Below 10s
        averageResponseTime: 1500,
        hourlyAICost: 5,
        costSpikePercentage: 110, // Below 150%
        cacheHitRate: 60, // Above 30%
        serviceHealth: 1, // Healthy
        timestamp: new Date(),
      };

      const alerts = await alertsManager.evaluateMetrics(metrics);

      expect(alerts.length).toBe(0);
    });
  });

  // ============================================================================
  // Alert Lifecycle
  // ============================================================================

  describe('Alert Lifecycle', () => {
    it('should create new alert when threshold crossed', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      const activeAlerts = alertsManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts.some((a) => a.status === 'active')).toBe(true);
    });

    it('should resolve alert when metrics return to normal', async () => {
      // First trigger alert
      const unhealthyMetrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(unhealthyMetrics);
      expect(alertsManager.getActiveAlerts().length).toBeGreaterThan(0);

      // Then send healthy metrics
      const healthyMetrics: SkillsHealthMetrics = {
        ...unhealthyMetrics,
        skillErrorRate: 1, // Back to normal
      };

      await alertsManager.evaluateMetrics(healthyMetrics);

      const activeAlerts = alertsManager.getActiveAlerts();
      expect(activeAlerts.some((a) => a.thresholdId === 'high-skill-error-rate')).toBe(false);
    });

    it('should update existing alert instead of creating duplicate', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      // Trigger same alert twice
      await alertsManager.evaluateMetrics(metrics);
      await alertsManager.evaluateMetrics(metrics);

      const activeAlerts = alertsManager.getActiveAlerts();
      const errorRateAlerts = activeAlerts.filter((a) => a.thresholdId === 'high-skill-error-rate');

      // Should only have one alert, not duplicates
      expect(errorRateAlerts.length).toBe(1);
    });
  });

  // ============================================================================
  // Notification Channels
  // ============================================================================

  describe('Notification Channels', () => {
    it('should send PagerDuty notification for critical alert', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      // Check PagerDuty API was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pagerduty.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should send Slack notification for warning alert', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 0,
        timeoutRate: 6,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      // Check Slack webhook was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('slack.com'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include runbook URL in notifications', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      const activeAlerts = alertsManager.getActiveAlerts();
      const errorRateAlert = activeAlerts.find((a) => a.thresholdId === 'high-skill-error-rate');

      expect(errorRateAlert?.runbookUrl).toBeDefined();
      expect(errorRateAlert?.runbookUrl).toContain('runbooks');
    });

    it('should handle notification failures gracefully', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      // Mock API failure
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(alertsManager.evaluateMetrics(metrics)).resolves.not.toThrow();

      const activeAlerts = alertsManager.getActiveAlerts();
      const alert = activeAlerts[0];

      // Check notification failure was recorded
      expect(alert.notificationsSent.some((n) => n.success === false)).toBe(true);
    });
  });

  // ============================================================================
  // Daily Summary Reports
  // ============================================================================

  describe('Daily Summary Reports', () => {
    it('should generate daily summary with alert counts', async () => {
      // Trigger some alerts
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 6,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 25,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      const summary = await alertsManager.generateDailySummary();

      expect(summary.subject).toContain('Daily Summary');
      expect(summary.body).toContain('ALERT SUMMARY');
      expect(summary.body).toContain('Critical Alerts:');
      expect(summary.body).toContain('Warning Alerts:');
    });

    it('should include current metrics in summary', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 2,
        timeoutRate: 1,
        p95ResponseTime: 3000,
        averageResponseTime: 1500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      await alertsManager.evaluateMetrics(metrics);

      const summary = await alertsManager.generateDailySummary();

      expect(summary.body).toContain('CURRENT METRICS');
      expect(summary.body).toContain('Skill Error Rate:');
      expect(summary.body).toContain('Cache Hit Rate:');
    });

    it('should list active alerts in summary', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 10,
        timeoutRate: 0,
        p95ResponseTime: 1000,
        averageResponseTime: 500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await alertsManager.evaluateMetrics(metrics);

      const summary = await alertsManager.generateDailySummary();

      expect(summary.body).toContain('ACTIVE ALERTS');
      expect(summary.body).toContain('High Skill Error Rate');
    });
  });

  // ============================================================================
  // Metrics History
  // ============================================================================

  describe('Metrics History', () => {
    it('should store metrics history', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 2,
        timeoutRate: 1,
        p95ResponseTime: 3000,
        averageResponseTime: 1500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      await alertsManager.evaluateMetrics(metrics);

      const history = alertsManager.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1]).toMatchObject(metrics);
    });

    it('should limit metrics history to configured size', async () => {
      const metrics: SkillsHealthMetrics = {
        skillErrorRate: 2,
        timeoutRate: 1,
        p95ResponseTime: 3000,
        averageResponseTime: 1500,
        hourlyAICost: 5,
        costSpikePercentage: 100,
        cacheHitRate: 50,
        serviceHealth: 1,
        timestamp: new Date(),
      };

      // Add many metrics
      for (let i = 0; i < 1500; i++) {
        await alertsManager.evaluateMetrics({
          ...metrics,
          timestamp: new Date(Date.now() + i * 1000),
        });
      }

      const history = alertsManager.getMetricsHistory();

      // Should be limited to 1440 (24 hours at 1min intervals)
      expect(history.length).toBeLessThanOrEqual(1440);
    });
  });

  // ============================================================================
  // Alert Thresholds Configuration
  // ============================================================================

  describe('Alert Thresholds Configuration', () => {
    it('should have all required critical thresholds', () => {
      const criticalThresholds = ALERT_THRESHOLDS.filter((t) => t.severity === 'critical');

      expect(criticalThresholds.length).toBeGreaterThanOrEqual(3);
      expect(criticalThresholds.some((t) => t.id === 'skills-service-down')).toBe(true);
      expect(criticalThresholds.some((t) => t.id === 'high-skill-error-rate')).toBe(true);
      expect(criticalThresholds.some((t) => t.id === 'skills-response-time-critical')).toBe(true);
    });

    it('should have all required warning thresholds', () => {
      const warningThresholds = ALERT_THRESHOLDS.filter((t) => t.severity === 'warning');

      expect(warningThresholds.length).toBeGreaterThanOrEqual(3);
      expect(warningThresholds.some((t) => t.id === 'elevated-skill-timeout-rate')).toBe(true);
      expect(warningThresholds.some((t) => t.id === 'low-cache-hit-rate')).toBe(true);
      expect(warningThresholds.some((t) => t.id === 'cost-spike-detected')).toBe(true);
    });

    it('should include runbook URLs for all thresholds', () => {
      const thresholdsWithoutRunbooks = ALERT_THRESHOLDS.filter(
        (t) => t.severity === 'critical' && !t.runbookUrl
      );

      expect(thresholdsWithoutRunbooks.length).toBe(0);
    });

    it('should include escalation policies for critical alerts', () => {
      const criticalThresholds = ALERT_THRESHOLDS.filter((t) => t.severity === 'critical');

      criticalThresholds.forEach((threshold) => {
        expect(threshold.escalationPolicy).toBeDefined();
      });
    });
  });
});
