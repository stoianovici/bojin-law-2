/**
 * Subscription Renewal Worker Unit Tests
 * Story 2.5 - Task 11: Implement Subscription Renewal Worker
 */

import {
  renewExpiringSubscriptions,
  startRenewalWorker,
  stopRenewalWorker,
  isWorkerRunning,
  getWorkerConfig,
} from '../../src/workers/subscription-renewal.worker';
import { webhookService } from '../../src/services/webhook.service';

// Mock dependencies
jest.mock('../../src/services/webhook.service');
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Use fake timers for testing setInterval
jest.useFakeTimers();

describe('Subscription Renewal Worker', () => {
  const mockAccessToken = 'mock-renewal-access-token';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    stopRenewalWorker();
  });

  afterEach(() => {
    stopRenewalWorker();
    jest.clearAllTimers();
  });

  describe('renewExpiringSubscriptions', () => {
    it('should return zero stats when no subscriptions need renewal', async () => {
      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue([]);

      const stats = await renewExpiringSubscriptions(mockAccessToken);

      expect(stats).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
      });

      expect(webhookService.getExpiringSubscriptions).toHaveBeenCalledWith(24);
    });

    it('should successfully renew all expiring subscriptions', async () => {
      const expiringSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          expirationDateTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
          changeTypes: 'created,updated',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-2',
          subscriptionId: 'graph-sub-2',
          resource: '/me/drive/root',
          expirationDateTime: new Date(Date.now() + 20 * 60 * 60 * 1000),
          changeTypes: 'created,updated,deleted',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue(
        expiringSubscriptions
      );

      (webhookService.renewSubscription as jest.Mock)
        .mockResolvedValueOnce({
          ...expiringSubscriptions[0],
          expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          lastRenewedAt: new Date(),
        })
        .mockResolvedValueOnce({
          ...expiringSubscriptions[1],
          expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          lastRenewedAt: new Date(),
        });

      const stats = await renewExpiringSubscriptions(mockAccessToken);

      expect(stats).toEqual({
        total: 2,
        successful: 2,
        failed: 0,
        errors: [],
      });

      expect(webhookService.renewSubscription).toHaveBeenCalledTimes(2);
      expect(webhookService.renewSubscription).toHaveBeenCalledWith('sub-1', mockAccessToken);
      expect(webhookService.renewSubscription).toHaveBeenCalledWith('sub-2', mockAccessToken);
    });

    it('should handle partial failures during renewal', async () => {
      const expiringSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          expirationDateTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
          changeTypes: 'created,updated',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-2',
          subscriptionId: 'graph-sub-2',
          resource: '/me/drive/root',
          expirationDateTime: new Date(Date.now() + 20 * 60 * 60 * 1000),
          changeTypes: 'created,updated,deleted',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-3',
          subscriptionId: 'graph-sub-3',
          resource: '/me/calendar/events',
          expirationDateTime: new Date(Date.now() + 22 * 60 * 60 * 1000),
          changeTypes: 'created,updated',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue(
        expiringSubscriptions
      );

      // First renewal succeeds
      (webhookService.renewSubscription as jest.Mock)
        .mockResolvedValueOnce({
          ...expiringSubscriptions[0],
          expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          lastRenewedAt: new Date(),
        })
        // Second renewal fails
        .mockRejectedValueOnce(new Error('Graph API error'))
        // Third renewal succeeds
        .mockResolvedValueOnce({
          ...expiringSubscriptions[2],
          expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          lastRenewedAt: new Date(),
        });

      const stats = await renewExpiringSubscriptions(mockAccessToken);

      expect(stats).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
        errors: [
          {
            subscriptionId: 'graph-sub-2',
            error: 'Graph API error',
          },
        ],
      });

      expect(webhookService.renewSubscription).toHaveBeenCalledTimes(3);
    });

    it('should continue processing after individual renewal failures', async () => {
      const expiringSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          expirationDateTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
          changeTypes: 'created,updated',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-2',
          subscriptionId: 'graph-sub-2',
          resource: '/me/drive/root',
          expirationDateTime: new Date(Date.now() + 20 * 60 * 60 * 1000),
          changeTypes: 'created,updated,deleted',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue(
        expiringSubscriptions
      );

      // Both renewals fail
      (webhookService.renewSubscription as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Invalid subscription'));

      const stats = await renewExpiringSubscriptions(mockAccessToken);

      expect(stats).toEqual({
        total: 2,
        successful: 0,
        failed: 2,
        errors: [
          {
            subscriptionId: 'graph-sub-1',
            error: 'Network timeout',
          },
          {
            subscriptionId: 'graph-sub-2',
            error: 'Invalid subscription',
          },
        ],
      });

      // Verify both renewals were attempted despite first failure
      expect(webhookService.renewSubscription).toHaveBeenCalledTimes(2);
    });

    it('should handle non-Error exceptions during renewal', async () => {
      const expiringSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          expirationDateTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
          changeTypes: 'created,updated',
          notificationUrl: 'http://localhost/webhooks/graph',
          clientState: 'test',
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue(
        expiringSubscriptions
      );

      // Renewal throws non-Error exception
      (webhookService.renewSubscription as jest.Mock).mockRejectedValueOnce('String error');

      const stats = await renewExpiringSubscriptions(mockAccessToken);

      expect(stats.failed).toBe(1);
      expect(stats.errors[0]).toEqual({
        subscriptionId: 'graph-sub-1',
        error: 'Unknown error',
      });
    });
  });

  describe('startRenewalWorker', () => {
    it('should start the worker and run immediately', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue([]);

      startRenewalWorker(mockGetAccessToken);

      expect(isWorkerRunning()).toBe(true);

      // Allow pending timers and promises to execute
      await jest.runOnlyPendingTimersAsync();

      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(webhookService.getExpiringSubscriptions).toHaveBeenCalled();
    });

    it('should not start if worker is already running', () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);

      startRenewalWorker(mockGetAccessToken);
      const firstCall = mockGetAccessToken.mock.calls.length;

      startRenewalWorker(mockGetAccessToken);
      const secondCall = mockGetAccessToken.mock.calls.length;

      // Second start should not trigger additional calls
      expect(secondCall).toBe(firstCall);
      expect(isWorkerRunning()).toBe(true);
    });

    it('should schedule periodic renewal checks', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue([]);

      startRenewalWorker(mockGetAccessToken);

      // Allow initial run to complete
      await jest.runOnlyPendingTimersAsync();

      const initialCalls = (webhookService.getExpiringSubscriptions as jest.Mock).mock.calls.length;

      // Fast-forward time by 1 hour (default check interval)
      jest.advanceTimersByTime(3600000);

      // Allow scheduled run to complete
      await jest.runOnlyPendingTimersAsync();

      const afterCalls = (webhookService.getExpiringSubscriptions as jest.Mock).mock.calls.length;

      expect(afterCalls).toBeGreaterThan(initialCalls);
    });

    it('should handle errors during initial renewal run', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      startRenewalWorker(mockGetAccessToken);

      // Allow initial run to complete (with error)
      await jest.runOnlyPendingTimersAsync();

      // Worker should still be running despite error
      expect(isWorkerRunning()).toBe(true);
    });

    it('should handle errors during scheduled renewal runs', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock)
        .mockResolvedValueOnce([]) // Initial run succeeds
        .mockRejectedValueOnce(new Error('Database error')); // First scheduled run fails

      startRenewalWorker(mockGetAccessToken);

      // Allow initial run to complete
      await jest.runOnlyPendingTimersAsync();

      // Fast-forward to first scheduled run
      jest.advanceTimersByTime(3600000);

      // Allow scheduled run to complete (with error)
      await jest.runOnlyPendingTimersAsync();

      // Worker should still be running
      expect(isWorkerRunning()).toBe(true);
    });
  });

  describe('stopRenewalWorker', () => {
    it('should stop the running worker', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue([]);

      startRenewalWorker(mockGetAccessToken);
      expect(isWorkerRunning()).toBe(true);

      stopRenewalWorker();
      expect(isWorkerRunning()).toBe(false);
    });

    it('should do nothing if worker is not running', () => {
      expect(isWorkerRunning()).toBe(false);

      stopRenewalWorker();
      expect(isWorkerRunning()).toBe(false);
    });

    it('should prevent scheduled runs after stopping', async () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);
      (webhookService.getExpiringSubscriptions as jest.Mock).mockResolvedValue([]);

      startRenewalWorker(mockGetAccessToken);

      // Allow initial run to complete
      await jest.runOnlyPendingTimersAsync();

      const callsBeforeStop = (webhookService.getExpiringSubscriptions as jest.Mock).mock.calls
        .length;

      stopRenewalWorker();

      // Fast-forward time
      jest.advanceTimersByTime(3600000);

      // Attempt to run any pending timers (should be none after stop)
      jest.runOnlyPendingTimers();

      const callsAfterStop = (webhookService.getExpiringSubscriptions as jest.Mock).mock.calls
        .length;

      // No additional calls should have been made
      expect(callsAfterStop).toBe(callsBeforeStop);
    });
  });

  describe('isWorkerRunning', () => {
    it('should return false initially', () => {
      expect(isWorkerRunning()).toBe(false);
    });

    it('should return true when worker is started', () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);

      startRenewalWorker(mockGetAccessToken);
      expect(isWorkerRunning()).toBe(true);
    });

    it('should return false after worker is stopped', () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);

      startRenewalWorker(mockGetAccessToken);
      stopRenewalWorker();
      expect(isWorkerRunning()).toBe(false);
    });
  });

  describe('getWorkerConfig', () => {
    it('should return correct configuration', () => {
      const config = getWorkerConfig();

      expect(config).toEqual({
        checkIntervalMs: expect.any(Number),
        thresholdHours: 24,
        isRunning: false,
      });
    });

    it('should reflect running state in configuration', () => {
      const mockGetAccessToken = jest.fn().mockResolvedValue(mockAccessToken);

      const configBefore = getWorkerConfig();
      expect(configBefore.isRunning).toBe(false);

      startRenewalWorker(mockGetAccessToken);

      const configAfter = getWorkerConfig();
      expect(configAfter.isRunning).toBe(true);
    });
  });
});
