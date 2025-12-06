/**
 * Token Alert Service Tests
 * Story 3.8: Document System Testing and Performance - Task 16
 *
 * Tests:
 * - Alert delivery
 * - Rate limiting
 * - Notification deduplication
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TokenAlertService, Alert, ALERT_THRESHOLDS } from './token-alerts';
import { TokenUsageMonitor } from './token-usage-monitor';

// Mock TokenUsageMonitor
const mockTokenMonitor = {
  checkBudget: jest.fn(),
  getUserHourlyUsage: jest.fn(),
  getAggregatedUsage: jest.fn(),
};

// Mock Email Service
const mockEmailService = {
  send: jest.fn(),
};

// Mock Notification Service
const mockNotificationService = {
  sendInApp: jest.fn(),
};

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
};

describe('TokenAlertService', () => {
  let alertService: TokenAlertService;

  beforeEach(() => {
    jest.clearAllMocks();

    alertService = new TokenAlertService(
      mockTokenMonitor as unknown as TokenUsageMonitor,
      mockEmailService as any,
      mockNotificationService as any,
      mockRedis as any
    );

    // Default mock implementations
    mockEmailService.send.mockResolvedValue(undefined);
    mockNotificationService.sendInApp.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
  });

  describe('checkAndAlertBudget', () => {
    it('should not send alert when budget is under 50%', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 3000,
        dailyBudget: 10000,
        dailyPercentage: 30,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');

      expect(alerts).toHaveLength(0);
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('should send warning alert at 50% budget', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('budget_warning');
      expect(alerts[0].severity).toBe('info');
    });

    it('should send critical alert at 75% budget', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 7500,
        dailyBudget: 10000,
        dailyPercentage: 75,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('budget_critical');
      expect(alerts[0].severity).toBe('warning');
    });

    it('should send exceeded alert at 90% budget', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 9000,
        dailyBudget: 10000,
        dailyPercentage: 90,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('budget_exceeded');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should send blocked alert at 100% budget', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 10000,
        dailyBudget: 10000,
        dailyPercentage: 100,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('budget_blocked');
      expect(alerts[0].severity).toBe('emergency');
    });
  });

  describe('checkUserRate', () => {
    it('should not alert when user rate is normal', async () => {
      mockTokenMonitor.getUserHourlyUsage.mockResolvedValue(500);

      const alert = await alertService.checkUserRate('user-001', 'firm-001');

      expect(alert).toBeNull();
    });

    it('should send warning when user rate exceeds warning threshold', async () => {
      mockTokenMonitor.getUserHourlyUsage.mockResolvedValue(
        ALERT_THRESHOLDS.userHourlyRate.warning + 100
      );

      const alert = await alertService.checkUserRate('user-001', 'firm-001');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('user_rate_warning');
    });

    it('should send spike alert when user rate exceeds spike threshold', async () => {
      mockTokenMonitor.getUserHourlyUsage.mockResolvedValue(
        ALERT_THRESHOLDS.userHourlyRate.spike + 100
      );

      const alert = await alertService.checkUserRate('user-001', 'firm-001');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('user_rate_spike');
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('checkCostAnomaly', () => {
    it('should not alert when cost is within normal range', async () => {
      mockTokenMonitor.getAggregatedUsage
        .mockResolvedValueOnce({ totalCostCents: 7000 }) // Weekly
        .mockResolvedValueOnce({ totalCostCents: 1000 }); // Daily

      const alert = await alertService.checkCostAnomaly('firm-001');

      expect(alert).toBeNull();
    });

    it('should alert when cost exceeds 200% of average', async () => {
      mockTokenMonitor.getAggregatedUsage
        .mockResolvedValueOnce({ totalCostCents: 7000 }) // Weekly (avg ~1000/day)
        .mockResolvedValueOnce({ totalCostCents: 2500 }); // Today (250% of average)

      const alert = await alertService.checkCostAnomaly('firm-001');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('cost_anomaly');
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect cooldown period between alerts', async () => {
      // First alert - should send
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');
      expect(mockEmailService.send).toHaveBeenCalledTimes(1);

      // Simulate rate limit in Redis
      mockRedis.get.mockResolvedValue(JSON.stringify({
        alertType: 'budget_warning',
        firmId: 'firm-001',
        lastSentAt: new Date().toISOString(),
        count: 1,
        windowStart: new Date().toISOString(),
      }));

      // Second alert immediately - should be rate limited
      jest.clearAllMocks();
      await alertService.checkAndAlertBudget('firm-001');
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('should allow alert after cooldown expires', async () => {
      // Simulate rate limit with old timestamp (past cooldown)
      const oldTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      mockRedis.get.mockResolvedValue(JSON.stringify({
        alertType: 'budget_warning',
        firmId: 'firm-001',
        lastSentAt: oldTime.toISOString(),
        count: 1,
        windowStart: oldTime.toISOString(),
      }));

      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('should enforce hourly limit', async () => {
      // Simulate rate limit with max hourly count
      const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      mockRedis.get.mockResolvedValue(JSON.stringify({
        alertType: 'budget_warning',
        firmId: 'firm-001',
        lastSentAt: recentTime.toISOString(),
        count: 10, // Way over limit
        windowStart: recentTime.toISOString(),
      }));

      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });

  describe('Alert Delivery', () => {
    it('should send email to recipients', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 10000,
        dailyBudget: 10000,
        dailyPercentage: 100,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.any(String), // email
        expect.stringContaining('AI Usage Alert'),
        expect.stringContaining('Daily AI budget exceeded'),
        expect.objectContaining({ priority: 'high' })
      );
    });

    it('should send in-app notification', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 10000,
        dailyBudget: 10000,
        dailyPercentage: 100,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');

      expect(mockNotificationService.sendInApp).toHaveBeenCalledWith(
        expect.any(String), // userId
        expect.objectContaining({
          title: expect.any(String),
          body: expect.stringContaining('budget exceeded'),
          type: 'ai_usage_budget_blocked',
        })
      );
    });

    it('should handle email delivery failure gracefully', async () => {
      mockEmailService.send.mockRejectedValue(new Error('Email service unavailable'));
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 10000,
        dailyBudget: 10000,
        dailyPercentage: 100,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      // Should not throw
      const alerts = await alertService.checkAndAlertBudget('firm-001');
      expect(alerts).toHaveLength(1);
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alert', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      const alerts = await alertService.checkAndAlertBudget('firm-001');
      const alertId = alerts[0].id;

      const result = await alertService.acknowledgeAlert(alertId, 'user-admin');

      expect(result).toBe(true);
    });

    it('should get unacknowledged alerts', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 7500,
        dailyBudget: 10000,
        dailyPercentage: 75,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');

      const unacknowledged = alertService.getUnacknowledgedAlerts('firm-001');
      expect(unacknowledged.length).toBeGreaterThan(0);
      expect(unacknowledged.every(a => !a.acknowledged)).toBe(true);
    });

    it('should get alert history', async () => {
      mockTokenMonitor.checkBudget.mockResolvedValue({
        dailyUsage: 5000,
        dailyBudget: 10000,
        dailyPercentage: 50,
        monthlyUsage: 50000,
        monthlyBudget: 200000,
        monthlyPercentage: 25,
        alerts: [],
      });

      await alertService.checkAndAlertBudget('firm-001');

      const history = alertService.getAlertHistory('firm-001');
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
