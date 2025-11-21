/**
 * Unit Tests for Webhook Service
 * Story 2.5 - Task 8: Create Webhook Infrastructure
 *
 * Tests subscription creation, renewal, deletion, and querying.
 * Target: 100% code coverage
 */

// Create mock methods BEFORE any imports
const mockGraphSubscriptionCreate = jest.fn();
const mockGraphSubscriptionFindUnique = jest.fn();
const mockGraphSubscriptionUpdate = jest.fn();
const mockGraphSubscriptionFindMany = jest.fn();

// Mock dependencies BEFORE imports
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    graphSubscription: {
      create: mockGraphSubscriptionCreate,
      findUnique: mockGraphSubscriptionFindUnique,
      update: mockGraphSubscriptionUpdate,
      findMany: mockGraphSubscriptionFindMany,
    },
  })),
}));

// Mock Graph Client
// IMPORTANT: Mock chain setup happens INSIDE Client.init() implementation
// to ensure it's re-created fresh on each call
// See TEST-001 fix documentation for details
jest.mock('@microsoft/microsoft-graph-client', () => {
  const mockApi = jest.fn();
  const mockPost = jest.fn();
  const mockPatch = jest.fn();
  const mockDelete = jest.fn();

  return {
    Client: {
      init: jest.fn(() => {
        // Set up the mock chain INSIDE init() so it's fresh each time
        mockApi.mockReturnValue({
          post: mockPost,
          patch: mockPatch,
          delete: mockDelete,
        });
        return { api: mockApi };
      }),
    },
    __mockApi: mockApi,
    __mockPost: mockPost,
    __mockPatch: mockPatch,
    __mockDelete: mockDelete,
  };
});

jest.mock('../../src/utils/retry.util', () => ({
  retryWithBackoff: jest.fn(async (fn: () => Promise<any>) => await fn()),
}));

jest.mock('../../src/utils/graph-error-handler', () => ({
  parseGraphError: jest.fn((error: any) => ({
    category: 'transient',
    statusCode: 500,
    errorCode: 'ServiceUnavailable',
    message: error.message || 'Service unavailable',
    isRetryable: true,
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// NOW import after mocks are set up
import { WebhookService } from '../../src/services/webhook.service';
const { retryWithBackoff } = require('../../src/utils/retry.util');
const { parseGraphError } = require('../../src/utils/graph-error-handler');

describe('WebhookService', () => {
  let webhookService: WebhookService;
  const mockAccessToken = 'mock-access-token';
  const mockSubscriptionId = 'db-subscription-id-123';
  const mockGraphSubscriptionId = 'graph-subscription-id-456';

  beforeEach(() => {
    // TEST-001 FIX: Do NOT clear mocks to preserve the Graph Client mock chain
    // The mock chain set up in the module mock must persist across tests
    // Trade-off: Call history accumulates, but tests remain isolated via mockResolvedValue

    // Mock environment variables
    process.env.WEBHOOK_BASE_URL = 'https://test-app.com';
    process.env.WEBHOOK_CLIENT_STATE = 'test-secret';

    webhookService = new WebhookService();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_BASE_URL;
    delete process.env.WEBHOOK_CLIENT_STATE;
  });

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      const { __mockApi, __mockPost } = require('@microsoft/microsoft-graph-client');

      const mockGraphResponse = {
        id: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeType: 'created,updated',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: '2025-11-23T23:00:00Z',
      };

      const mockDbSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      __mockPost.mockResolvedValue(mockGraphResponse);
      mockGraphSubscriptionCreate.mockResolvedValue(mockDbSubscription);

      const result = await webhookService.createSubscription({
        resource: '/me/messages',
        changeTypes: ['created', 'updated'],
        accessToken: mockAccessToken,
        clientState: 'test-secret',
      });

      expect(result).toEqual(mockDbSubscription);
      expect(__mockApi).toHaveBeenCalledWith('/subscriptions');
      expect(mockGraphSubscriptionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: mockGraphSubscriptionId,
          resource: '/me/messages',
          changeTypes: 'created,updated',
          isActive: true,
        }),
      });
    });

    it('should use environment variables for notification URL and client state', async () => {
      const { __mockPost } = require('@microsoft/microsoft-graph-client');

      const mockGraphResponse = {
        id: mockGraphSubscriptionId,
        resource: '/me/drive/root',
        changeType: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: '2025-11-23T23:00:00Z',
      };

      __mockPost.mockResolvedValue(mockGraphResponse);
      mockGraphSubscriptionCreate.mockResolvedValue({
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/drive/root',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      });

      await webhookService.createSubscription({
        resource: '/me/drive/root',
        changeTypes: ['created'],
        accessToken: mockAccessToken,
      });

      expect(__mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
        })
      );
    });

    it('should use default localhost URL when WEBHOOK_BASE_URL not set', async () => {
      const { __mockPost } = require('@microsoft/microsoft-graph-client');
      delete process.env.WEBHOOK_BASE_URL;

      const mockGraphResponse = {
        id: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeType: 'created',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: '2025-11-23T23:00:00Z',
      };

      __mockPost.mockResolvedValue(mockGraphResponse);
      mockGraphSubscriptionCreate.mockResolvedValue({
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      });

      await webhookService.createSubscription({
        resource: '/me/messages',
        changeTypes: ['created'],
        accessToken: mockAccessToken,
      });

      expect(__mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationUrl: 'http://localhost:3000/webhooks/graph',
        })
      );
    });

    it('should handle Graph API errors during subscription creation', async () => {
      const { __mockPost } = require('@microsoft/microsoft-graph-client');
      const mockError = new Error('Graph API error');

      __mockPost.mockRejectedValue(mockError);

      await expect(
        webhookService.createSubscription({
          resource: '/me/messages',
          changeTypes: ['created'],
          accessToken: mockAccessToken,
        })
      ).rejects.toThrow(mockError);

      expect(parseGraphError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('renewSubscription', () => {
    it('should renew a subscription successfully', async () => {
      const { __mockApi, __mockPatch } = require('@microsoft/microsoft-graph-client');

      const mockDbSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-21T23:00:00Z'),
        createdAt: new Date('2025-11-20T23:00:00Z'),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockGraphResponse = {
        id: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeType: 'created,updated',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: '2025-11-24T23:00:00Z',
      };

      const mockUpdatedSubscription = {
        ...mockDbSubscription,
        expirationDateTime: new Date('2025-11-24T23:00:00Z'),
        lastRenewedAt: new Date(),
      };

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockDbSubscription);

      __mockPatch.mockResolvedValue(mockGraphResponse);
      mockGraphSubscriptionUpdate.mockResolvedValue(mockUpdatedSubscription);

      const result = await webhookService.renewSubscription(mockSubscriptionId, mockAccessToken);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(__mockApi).toHaveBeenCalledWith(`/subscriptions/${mockGraphSubscriptionId}`);
      expect(mockGraphSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          expirationDateTime: new Date('2025-11-24T23:00:00Z'),
          lastRenewedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error when subscription not found', async () => {
      mockGraphSubscriptionFindUnique.mockResolvedValue(null);

      await expect(
        webhookService.renewSubscription(mockSubscriptionId, mockAccessToken)
      ).rejects.toThrow(`Subscription not found: ${mockSubscriptionId}`);
    });

    it('should handle Graph API errors during renewal', async () => {
      const { __mockPatch } = require('@microsoft/microsoft-graph-client');

      const mockDbSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-21T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockError = new Error('Graph API renewal error');

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockDbSubscription);

      __mockPatch.mockRejectedValue(mockError);

      await expect(
        webhookService.renewSubscription(mockSubscriptionId, mockAccessToken)
      ).rejects.toThrow(mockError);

      expect(parseGraphError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('deleteSubscription', () => {
    it('should delete a subscription successfully', async () => {
      const { __mockApi, __mockDelete } = require('@microsoft/microsoft-graph-client');

      const mockDbSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockDbSubscription);

      __mockDelete.mockResolvedValue(undefined);
      mockGraphSubscriptionUpdate.mockResolvedValue({
        ...mockDbSubscription,
        isActive: false,
      });

      await webhookService.deleteSubscription(mockSubscriptionId, mockAccessToken);

      expect(__mockApi).toHaveBeenCalledWith(`/subscriptions/${mockGraphSubscriptionId}`);
      expect(mockGraphSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: { isActive: false },
      });
    });

    it('should throw error when subscription not found for deletion', async () => {
      mockGraphSubscriptionFindUnique.mockResolvedValue(null);

      await expect(
        webhookService.deleteSubscription(mockSubscriptionId, mockAccessToken)
      ).rejects.toThrow(`Subscription not found: ${mockSubscriptionId}`);
    });

    it('should handle Graph API errors during deletion', async () => {
      const { __mockDelete } = require('@microsoft/microsoft-graph-client');

      const mockDbSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockError = new Error('Graph API deletion error');

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockDbSubscription);

      __mockDelete.mockRejectedValue(mockError);

      await expect(
        webhookService.deleteSubscription(mockSubscriptionId, mockAccessToken)
      ).rejects.toThrow(mockError);

      expect(parseGraphError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getExpiringSubscriptions', () => {
    it('should retrieve subscriptions expiring within default threshold (24 hours)', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          changeTypes: 'created',
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
          expirationDateTime: new Date('2025-11-21T12:00:00Z'),
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-2',
          subscriptionId: 'graph-sub-2',
          resource: '/me/drive/root',
          changeTypes: 'created,updated',
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
          expirationDateTime: new Date('2025-11-21T18:00:00Z'),
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      mockGraphSubscriptionFindMany.mockResolvedValue(mockSubscriptions);

      const result = await webhookService.getExpiringSubscriptions();

      expect(result).toEqual(mockSubscriptions);
      expect(mockGraphSubscriptionFindMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expirationDateTime: {
            lte: expect.any(Date),
          },
        },
        orderBy: {
          expirationDateTime: 'asc',
        },
      });
    });

    it('should retrieve subscriptions expiring within custom threshold', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          changeTypes: 'created',
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
          expirationDateTime: new Date('2025-11-21T02:00:00Z'),
          createdAt: new Date(),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      mockGraphSubscriptionFindMany.mockResolvedValue(mockSubscriptions);

      const result = await webhookService.getExpiringSubscriptions(2); // 2 hours

      expect(result).toEqual(mockSubscriptions);
    });

    it('should handle errors when fetching expiring subscriptions', async () => {
      const mockError = new Error('Database error');

      mockGraphSubscriptionFindMany.mockRejectedValue(mockError);

      await expect(webhookService.getExpiringSubscriptions()).rejects.toThrow(mockError);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should retrieve all active subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          subscriptionId: 'graph-sub-1',
          resource: '/me/messages',
          changeTypes: 'created',
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
          expirationDateTime: new Date('2025-11-23T23:00:00Z'),
          createdAt: new Date('2025-11-20T23:00:00Z'),
          lastRenewedAt: null,
          isActive: true,
        },
        {
          id: 'sub-2',
          subscriptionId: 'graph-sub-2',
          resource: '/me/drive/root',
          changeTypes: 'created,updated',
          notificationUrl: 'https://test-app.com/webhooks/graph',
          clientState: 'test-secret',
          expirationDateTime: new Date('2025-11-23T23:00:00Z'),
          createdAt: new Date('2025-11-20T22:00:00Z'),
          lastRenewedAt: null,
          isActive: true,
        },
      ];

      mockGraphSubscriptionFindMany.mockResolvedValue(mockSubscriptions);

      const result = await webhookService.getActiveSubscriptions();

      expect(result).toEqual(mockSubscriptions);
      expect(mockGraphSubscriptionFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors when fetching active subscriptions', async () => {
      const mockError = new Error('Database error');

      mockGraphSubscriptionFindMany.mockRejectedValue(mockError);

      await expect(webhookService.getActiveSubscriptions()).rejects.toThrow(mockError);
    });
  });

  describe('getSubscriptionById', () => {
    it('should retrieve subscription by ID', async () => {
      const mockSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockSubscription);

      const result = await webhookService.getSubscriptionById(mockSubscriptionId);

      expect(result).toEqual(mockSubscription);
      expect(mockGraphSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
      });
    });

    it('should return null when subscription not found', async () => {
      mockGraphSubscriptionFindUnique.mockResolvedValue(null);

      const result = await webhookService.getSubscriptionById(mockSubscriptionId);

      expect(result).toBeNull();
    });

    it('should handle errors when fetching subscription by ID', async () => {
      const mockError = new Error('Database error');

      mockGraphSubscriptionFindUnique.mockRejectedValue(mockError);

      await expect(webhookService.getSubscriptionById(mockSubscriptionId)).rejects.toThrow(
        mockError
      );
    });
  });

  describe('getSubscriptionByGraphId', () => {
    it('should retrieve subscription by Graph API subscription ID', async () => {
      const mockSubscription = {
        id: mockSubscriptionId,
        subscriptionId: mockGraphSubscriptionId,
        resource: '/me/messages',
        changeTypes: 'created',
        notificationUrl: 'https://test-app.com/webhooks/graph',
        clientState: 'test-secret',
        expirationDateTime: new Date('2025-11-23T23:00:00Z'),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      mockGraphSubscriptionFindUnique.mockResolvedValue(mockSubscription);

      const result = await webhookService.getSubscriptionByGraphId(mockGraphSubscriptionId);

      expect(result).toEqual(mockSubscription);
      expect(mockGraphSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { subscriptionId: mockGraphSubscriptionId },
      });
    });

    it('should return null when subscription not found by Graph ID', async () => {
      mockGraphSubscriptionFindUnique.mockResolvedValue(null);

      const result = await webhookService.getSubscriptionByGraphId(mockGraphSubscriptionId);

      expect(result).toBeNull();
    });

    it('should handle errors when fetching subscription by Graph ID', async () => {
      const mockError = new Error('Database error');

      mockGraphSubscriptionFindUnique.mockRejectedValue(mockError);

      await expect(
        webhookService.getSubscriptionByGraphId(mockGraphSubscriptionId)
      ).rejects.toThrow(mockError);
    });
  });

  describe('validateWebhook', () => {
    it('should return validation token', () => {
      const validationToken = 'test-validation-token';

      const result = webhookService.validateWebhook(validationToken);

      expect(result).toBe(validationToken);
    });
  });
});
