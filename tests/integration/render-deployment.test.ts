/**
 * Render Deployment Integration Tests
 *
 * These tests validate that the Render deployment is correctly configured
 * and all services are operational.
 *
 * Run against staging: RENDER_ENV=staging npm run test:render
 * Run against production: RENDER_ENV=production npm run test:render
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Configuration
const RENDER_ENV = process.env.RENDER_ENV || 'staging';
const BASE_URL = process.env.RENDER_BASE_URL || `https://legal-platform-${RENDER_ENV}.onrender.com`;

// Service endpoints
const SERVICES = {
  web: `${BASE_URL}`,
  gateway: `${BASE_URL}/api`,
  'document-service': process.env.DOCUMENT_SERVICE_URL || 'http://document-service:4001',
  'ai-service': process.env.AI_SERVICE_URL || 'http://ai-service:4003',
  'task-service': process.env.TASK_SERVICE_URL || 'http://task-service:4002',
  'integration-service': process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:4004',
  'notification-service':
    process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005',
};

// Timeout for all tests (Render cold starts can be slow)
const TEST_TIMEOUT = 30000;

describe('Render Deployment Integration Tests', () => {
  describe('Test 1: Health Checks', () => {
    it(
      'should verify web service responds to /health',
      async () => {
        const response = await fetch(`${SERVICES.web}/api/health`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('healthy');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify gateway service responds to /api/health',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('healthy');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify all microservices respond to health checks',
      async () => {
        const microservices = [
          'document-service',
          'ai-service',
          'task-service',
          'integration-service',
          'notification-service',
        ];

        for (const service of microservices) {
          const url = SERVICES[service as keyof typeof SERVICES];
          const response = await fetch(`${url}/health`);

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.status).toBe('healthy');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 2: Database Connectivity', () => {
    it(
      'should verify PostgreSQL database is accessible',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/db`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('database');
        expect(data.database.status).toBe('connected');
        expect(data.database.type).toBe('postgresql');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify database has correct schema version',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/db`);
        const data = await response.json();

        expect(data.database).toHaveProperty('migrations');
        expect(data.database.migrations).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 3: Redis Connectivity', () => {
    it(
      'should verify Redis cache is accessible',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/redis`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('redis');
        expect(data.redis.status).toBe('connected');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify Redis can store and retrieve data',
      async () => {
        const testKey = `test-${Date.now()}`;
        const testValue = 'render-integration-test';

        // Set value
        await fetch(`${SERVICES.gateway}/health/redis/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: testKey, value: testValue }),
        });

        // Get value
        const response = await fetch(`${SERVICES.gateway}/health/redis/get?key=${testKey}`);
        const data = await response.json();

        expect(data.value).toBe(testValue);
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 4: Service Communication (Web → Gateway → Services)', () => {
    it(
      'should verify web app can reach API gateway',
      async () => {
        const response = await fetch(`${SERVICES.web}/api/health`);
        expect(response.status).toBe(200);
      },
      TEST_TIMEOUT
    );

    it(
      'should verify gateway can communicate with microservices',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/services`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('services');
        expect(data.services).toHaveProperty('document-service');
        expect(data.services).toHaveProperty('ai-service');
        expect(data.services).toHaveProperty('task-service');
        expect(data.services).toHaveProperty('integration-service');
        expect(data.services).toHaveProperty('notification-service');

        // All services should be reachable
        Object.values(data.services).forEach((service: any) => {
          expect(service.status).toBe('reachable');
        });
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 5: Inter-service Communication', () => {
    it(
      'should verify services can communicate with each other',
      async () => {
        // Test: Gateway → Document Service
        const docResponse = await fetch(`${SERVICES.gateway}/health/service/document-service`);
        expect(docResponse.status).toBe(200);

        // Test: Gateway → AI Service
        const aiResponse = await fetch(`${SERVICES.gateway}/health/service/ai-service`);
        expect(aiResponse.status).toBe(200);

        // Test: Gateway → Task Service
        const taskResponse = await fetch(`${SERVICES.gateway}/health/service/task-service`);
        expect(taskResponse.status).toBe(200);
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 6: Environment Variables', () => {
    it(
      'should verify all required environment variables are set',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/env`);
        expect(response.status).toBe(200);

        const data = await response.json();
        const requiredVars = ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];

        requiredVars.forEach((varName) => {
          expect(data.env[varName]).toBeDefined();
          expect(data.env[varName]).not.toBe('');
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should verify Render-injected environment variables are present',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/env`);
        const data = await response.json();

        const renderVars = [
          'DATABASE_URL',
          'REDIS_URL',
          'RENDER_SERVICE_NAME',
          'RENDER_EXTERNAL_URL',
        ];

        renderVars.forEach((varName) => {
          expect(data.env[varName]).toBeDefined();
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should verify no Azure-specific environment variables exist',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/env`);
        const data = await response.json();

        const azureVars = [
          'AZURE_STORAGE_CONNECTION_STRING',
          'AZURE_KEY_VAULT_URI',
          'APPLICATIONINSIGHTS_CONNECTION_STRING',
        ];

        azureVars.forEach((varName) => {
          expect(data.env[varName]).toBeUndefined();
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should verify NODE_ENV is set correctly',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/env`);
        const data = await response.json();

        expect(data.env.NODE_ENV).toMatch(/^(staging|production)$/);
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 7: File Storage', () => {
    it(
      'should verify file storage is configured',
      async () => {
        const response = await fetch(`${SERVICES['document-service']}/health/storage`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('storage');
        expect(data.storage.status).toBe('configured');
        expect(data.storage.provider).toMatch(/^(cloudflare-r2|azure-blob|local)$/);
      },
      TEST_TIMEOUT
    );

    it(
      'should verify file upload works',
      async () => {
        const testFile = new Blob(['Test file content'], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', testFile, 'test.txt');

        const response = await fetch(`${SERVICES['document-service']}/health/storage/upload`, {
          method: 'POST',
          body: formData,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('url');
        expect(data.url).toContain('test.txt');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify file download works',
      async () => {
        // First upload a file
        const testFile = new Blob(['Test download content'], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', testFile, 'test-download.txt');

        const uploadResponse = await fetch(
          `${SERVICES['document-service']}/health/storage/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );
        const uploadData = await uploadResponse.json();

        // Then download it
        const downloadResponse = await fetch(uploadData.url);
        expect(downloadResponse.status).toBe(200);

        const content = await downloadResponse.text();
        expect(content).toBe('Test download content');
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 8: Monitoring', () => {
    it(
      'should verify Render metrics are available',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/metrics`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('metrics');
        expect(data.metrics).toHaveProperty('requestCount');
        expect(data.metrics).toHaveProperty('errorCount');
        expect(data.metrics).toHaveProperty('uptime');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify monitoring data is being collected',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/metrics`);
        const data = await response.json();

        expect(data.metrics.uptime).toBeGreaterThan(0);
        expect(typeof data.metrics.memoryUsage).toBe('number');
        expect(typeof data.metrics.cpuUsage).toBe('number');
      },
      TEST_TIMEOUT
    );

    it(
      'should verify error tracking is configured',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/error-tracking`);
        const data = await response.json();

        expect(data).toHaveProperty('errorTracking');
        expect(data.errorTracking.status).toMatch(/^(enabled|disabled)$/);
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 9: Logs Accessible', () => {
    it(
      'should verify logs can be retrieved from services',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/logs`);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('logs');
        expect(Array.isArray(data.logs)).toBe(true);
        expect(data.logs.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should verify log format includes required fields',
      async () => {
        const response = await fetch(`${SERVICES.gateway}/health/logs`);
        const data = await response.json();

        const firstLog = data.logs[0];
        expect(firstLog).toHaveProperty('timestamp');
        expect(firstLog).toHaveProperty('level');
        expect(firstLog).toHaveProperty('message');
        expect(firstLog).toHaveProperty('service');
      },
      TEST_TIMEOUT
    );
  });

  describe('Test 10: Performance Baseline', () => {
    it(
      'should verify API response times are acceptable',
      async () => {
        const startTime = Date.now();
        const response = await fetch(`${SERVICES.gateway}/health`);
        const endTime = Date.now();

        expect(response.status).toBe(200);

        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(2000); // p95 < 2s
      },
      TEST_TIMEOUT
    );

    it(
      'should verify database query performance',
      async () => {
        const startTime = Date.now();
        const response = await fetch(`${SERVICES.gateway}/health/db`);
        const endTime = Date.now();

        expect(response.status).toBe(200);

        const queryTime = endTime - startTime;
        expect(queryTime).toBeLessThan(500); // DB queries < 500ms
      },
      TEST_TIMEOUT
    );
  });
});

// Utility function to run tests
export async function runRenderIntegrationTests() {
  console.log(`Running Render Integration Tests against ${RENDER_ENV}...`);
  console.log(`Base URL: ${BASE_URL}`);

  // Tests will run via Jest
  // This function can be called from deployment scripts
}
