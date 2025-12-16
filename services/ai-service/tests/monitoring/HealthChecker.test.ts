/**
 * HealthChecker Tests
 *
 * Tests for production health monitoring including:
 * - Service health checks (database, Redis, Claude API, Skills API)
 * - Skills metrics collection
 * - Resource usage monitoring
 * - Health status aggregation
 * - Health history tracking
 */

import {
  HealthChecker,
  HealthCheckResult,
  ServiceHealth,
} from '../../src/monitoring/HealthChecker';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let mockDatabase: any;
  let mockRedis: any;
  let mockClaudeAPI: any;

  beforeEach(() => {
    // Mock database connection
    mockDatabase = {
      query: jest.fn(),
    };

    // Mock Redis connection
    mockRedis = {
      ping: jest.fn(),
      info: jest.fn(),
    };

    // Mock Claude API client
    mockClaudeAPI = {
      healthCheck: jest.fn(),
    };

    healthChecker = new HealthChecker({
      database: mockDatabase,
      redis: mockRedis,
      claudeAPI: mockClaudeAPI,
    });
  });

  // ============================================================================
  // Comprehensive Health Checks
  // ============================================================================

  describe('Comprehensive Health Checks', () => {
    it('should perform health check for all services', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.services).toBeDefined();
      expect(result.skillsMetrics).toBeDefined();
      expect(result.resourceUsage).toBeDefined();
    });

    it('should mark overall status as healthy when all services healthy', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
    });

    it('should mark overall status as unhealthy when any service fails', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Connection failed'));
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('unhealthy');
    });

    it('should mark overall status as degraded when service slow', async () => {
      // Simulate slow database (>1000ms)
      mockDatabase.query.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ health: 1 }]), 1100))
      );
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('degraded');
      expect(result.services.database.responseTime).toBeGreaterThan(1000);
    });
  });

  // ============================================================================
  // Service-Specific Health Checks
  // ============================================================================

  describe('Database Health Check', () => {
    it('should check database connectivity', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT 1 as health');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.database.responseTime).toBeDefined();
    });

    it('should handle database connection failure', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Connection timeout'));
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.database.status).toBe('unhealthy');
      expect(result.services.database.error).toContain('Connection timeout');
    });

    it('should mark database as degraded when slow', async () => {
      mockDatabase.query.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ health: 1 }]), 1100))
      );
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.database.status).toBe('degraded');
    });
  });

  describe('Redis Health Check', () => {
    it('should check Redis connectivity', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(result.services.redis.status).toBe('healthy');
    });

    it('should handle Redis connection failure', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.redis.status).toBe('unhealthy');
      expect(result.services.redis.error).toContain('Redis unavailable');
    });

    it('should mark Redis as degraded when slow (<100ms threshold)', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 150))
      );
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.redis.status).toBe('degraded');
    });
  });

  describe('Claude API Health Check', () => {
    it('should check Claude API connectivity', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(mockClaudeAPI.healthCheck).toHaveBeenCalled();
      expect(result.services.claudeAPI.status).toBe('healthy');
    });

    it('should handle Claude API failure', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(false);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.claudeAPI.status).toBe('unhealthy');
    });

    it('should handle missing health check method gracefully', async () => {
      const mockClaudeWithoutHealthCheck = {};
      const checker = new HealthChecker({
        database: mockDatabase,
        redis: mockRedis,
        claudeAPI: mockClaudeWithoutHealthCheck as any,
      });

      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await checker.performHealthCheck();

      // Should not fail even without healthCheck method
      expect(result.services.claudeAPI).toBeDefined();
    });
  });

  describe('Skills API Health Check', () => {
    it('should check Skills API functionality', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.services.skillsAPI).toBeDefined();
      expect(result.services.skillsAPI.status).toMatch(/healthy|degraded|unhealthy/);
    });
  });

  // ============================================================================
  // Quick Health Check
  // ============================================================================

  describe('Quick Health Check', () => {
    it('should perform quick database-only health check', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);

      const result = await healthChecker.quickHealthCheck();

      expect(result.status).toBe('healthy');
      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT 1 as health');
    });

    it('should return unhealthy on database failure', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database down'));

      const result = await healthChecker.quickHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details).toContain('Database down');
    });
  });

  // ============================================================================
  // Skills Metrics
  // ============================================================================

  describe('Skills Metrics', () => {
    it('should include skills metrics in health check', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.skillsMetrics).toBeDefined();
      expect(result.skillsMetrics.activeSkillsCount).toBeDefined();
      expect(result.skillsMetrics.cacheHitRate).toBeDefined();
      expect(result.skillsMetrics.avgResponseTimeMs).toBeDefined();
      expect(result.skillsMetrics.errorRate).toBeDefined();
    });
  });

  // ============================================================================
  // Resource Usage
  // ============================================================================

  describe('Resource Usage', () => {
    it('should monitor memory usage', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.resourceUsage.memoryUsageMB).toBeGreaterThan(0);
      expect(result.resourceUsage.memoryPercentage).toBeGreaterThanOrEqual(0);
      expect(result.resourceUsage.memoryPercentage).toBeLessThanOrEqual(100);
    });

    it('should monitor CPU usage', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();

      expect(result.resourceUsage.cpuUsagePercent).toBeGreaterThanOrEqual(0);
      expect(result.resourceUsage.cpuUsagePercent).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // Health History
  // ============================================================================

  describe('Health History', () => {
    it('should maintain health check history', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      await healthChecker.performHealthCheck();
      await healthChecker.performHealthCheck();
      await healthChecker.performHealthCheck();

      const history = healthChecker.getHealthHistory();

      expect(history.length).toBe(3);
    });

    it('should limit health history size', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      // Perform 150 health checks
      for (let i = 0; i < 150; i++) {
        await healthChecker.performHealthCheck();
      }

      const history = healthChecker.getHealthHistory();

      // Should be limited to 100
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should limit returned history', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      for (let i = 0; i < 20; i++) {
        await healthChecker.performHealthCheck();
      }

      const limitedHistory = healthChecker.getHealthHistory(5);

      expect(limitedHistory.length).toBe(5);
    });
  });

  // ============================================================================
  // Uptime Tracking
  // ============================================================================

  describe('Uptime Tracking', () => {
    it('should track uptime', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await healthChecker.performHealthCheck();

      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should provide uptime in seconds', () => {
      const uptime = healthChecker.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(uptime)).toBe(true);
    });

    it('should reset uptime', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const uptimeBefore = healthChecker.getUptime();
      expect(uptimeBefore).toBeGreaterThan(0);

      healthChecker.resetUptime();

      const uptimeAfter = healthChecker.getUptime();
      expect(uptimeAfter).toBeLessThan(uptimeBefore);
    });
  });

  // ============================================================================
  // Formatting
  // ============================================================================

  describe('Formatting', () => {
    it('should format health check as JSON', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();
      const json = healthChecker.formatHealthCheckJSON(result);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.status).toBeDefined();
      expect(parsed.services).toBeDefined();
    });

    it('should format health check as text', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();
      const text = healthChecker.formatHealthCheckText(result);

      expect(text).toContain('SKILLS HEALTH CHECK');
      expect(text).toContain('SERVICES');
      expect(text).toContain('SKILLS METRICS');
      expect(text).toContain('RESOURCE USAGE');
    });

    it('should include status icons in text format', async () => {
      mockDatabase.query.mockResolvedValue([{ health: 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();
      const text = healthChecker.formatHealthCheckText(result);

      // Should contain checkmark for healthy services
      expect(text).toContain('✅');
    });

    it('should show error details in text format', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));
      mockRedis.ping.mockResolvedValue('PONG');
      mockClaudeAPI.healthCheck.mockResolvedValue(true);

      const result = await healthChecker.performHealthCheck();
      const text = healthChecker.formatHealthCheckText(result);

      expect(text).toContain('❌'); // Unhealthy icon
      expect(text).toContain('Database connection failed');
    });
  });

  // ============================================================================
  // No Connections Configured
  // ============================================================================

  describe('No Connections Configured', () => {
    it('should handle missing connections gracefully', async () => {
      const checker = new HealthChecker({});

      const result = await checker.performHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
    });
  });
});
