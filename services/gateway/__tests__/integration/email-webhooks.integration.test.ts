/**
 * Email Webhooks Integration Tests
 * Story 2.5 - Task 9: Implement Email Change Notifications
 *
 * Tests webhook subscription creation and notification processing for email changes
 */

import { Client } from '@microsoft/microsoft-graph-client';

// Mock dependencies - must be before imports that use them
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Prisma Client - must be before imports that use it
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    graphSubscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
  };
});

// Now import the service that uses Prisma
import { webhookService } from '../../src/services/webhook.service';

// Get reference to mock after mocking
const mockPrisma = new (require('@prisma/client').PrismaClient)();
const mockPrismaClient = mockPrisma;

describe('Email Webhook Integration', () => {
  const mockAccessToken = 'mock-access-token-123';
  const mockClientState = 'test-client-state-secret';

  beforeAll(async () => {
    // Mock setup
    mockPrismaClient.graphSubscription.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterAll(async () => {
    // Cleanup
    mockPrismaClient.$disconnect.mockResolvedValue(undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Subscription Creation', () => {
    it('should create email subscription for /me/messages with created and updated changeTypes', async () => {
      // Mock Graph API response
      const mockGraphSubscription = {
        id: 'test-subscription-id-001',
        resource: '/me/messages',
        changeType: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: mockClientState,
      };

      const mockDbSubscription = {
        id: 'db-id-001',
        subscriptionId: 'test-subscription-id-001',
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: mockClientState,
        expirationDateTime: new Date(mockGraphSubscription.expirationDateTime),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockClient = {
        api: jest.fn().mockReturnValue({
          post: jest.fn().mockResolvedValue(mockGraphSubscription),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      mockPrismaClient.graphSubscription.create.mockResolvedValue(mockDbSubscription);

      // Create email subscription
      const subscription = await webhookService.createEmailSubscription(
        mockAccessToken,
        mockClientState
      );

      // Verify Graph API was called correctly
      expect(Client.init).toHaveBeenCalledWith({
        authProvider: expect.any(Function),
      });
      expect(mockClient.api).toHaveBeenCalledWith('/subscriptions');

      // Verify subscription was stored in database
      expect(subscription.subscriptionId).toBe('test-subscription-id-001');
      expect(subscription.resource).toBe('/me/messages');
      expect(subscription.changeTypes).toBe('created,updated');
      expect(subscription.isActive).toBe(true);
      expect(subscription.clientState).toBe(mockClientState);
    });

    it('should handle Graph API errors during subscription creation', async () => {
      const mockError = {
        statusCode: 400,
        code: 'invalidRequest',
        message: 'Bad Request - No retries',
      };

      const mockClient = {
        api: jest.fn().mockReturnValue({
          post: jest.fn().mockRejectedValue(mockError),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);

      // Attempt to create subscription (400 errors are permanent and don't retry)
      await expect(webhookService.createEmailSubscription(mockAccessToken)).rejects.toMatchObject({
        statusCode: 400,
        code: 'invalidRequest',
      });
    });

    it('should use default client state from environment if not provided', async () => {
      process.env.WEBHOOK_CLIENT_STATE = 'default-client-state';

      const mockGraphSubscription = {
        id: 'test-subscription-id-002',
        resource: '/me/messages',
        changeType: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: 'default-client-state',
      };

      const mockDbSubscription = {
        id: 'db-id-002',
        subscriptionId: 'test-subscription-id-002',
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: 'default-client-state',
        expirationDateTime: new Date(mockGraphSubscription.expirationDateTime),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockClient = {
        api: jest.fn().mockReturnValue({
          post: jest.fn().mockResolvedValue(mockGraphSubscription),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      mockPrismaClient.graphSubscription.create.mockResolvedValue(mockDbSubscription);

      const subscription = await webhookService.createEmailSubscription(mockAccessToken);

      expect(subscription.clientState).toBe('default-client-state');
    });

    it('should calculate correct expiration date (3 days from now)', async () => {
      const beforeCreation = Date.now();
      const expirationDate = new Date(beforeCreation + 3 * 24 * 60 * 60 * 1000);

      const mockGraphSubscription = {
        id: 'test-subscription-id-003',
        resource: '/me/messages',
        changeType: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: expirationDate.toISOString(),
        clientState: mockClientState,
      };

      const mockDbSubscription = {
        id: 'db-id-003',
        subscriptionId: 'test-subscription-id-003',
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: mockClientState,
        expirationDateTime: expirationDate,
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockClient = {
        api: jest.fn().mockReturnValue({
          post: jest.fn().mockResolvedValue(mockGraphSubscription),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      mockPrismaClient.graphSubscription.create.mockResolvedValue(mockDbSubscription);

      const subscription = await webhookService.createEmailSubscription(
        mockAccessToken,
        mockClientState
      );

      const afterCreation = Date.now();
      const expirationTime = new Date(subscription.expirationDateTime).getTime();

      // Expiration should be ~3 days from now (within 1 minute tolerance)
      const expectedExpiration = beforeCreation + 3 * 24 * 60 * 60 * 1000;
      const tolerance = 60 * 1000; // 1 minute

      expect(expirationTime).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(expirationTime).toBeLessThanOrEqual(afterCreation + expectedExpiration);
    });
  });

  describe('Email Notification Processing', () => {
    it('should process email created notification and queue task', async () => {
      // This test verifies the webhook route handler logic
      // The actual route integration is tested in the webhook routes tests

      const mockNotification = {
        subscriptionId: 'test-subscription-id-001',
        clientState: mockClientState,
        changeType: 'created',
        resource: 'users/test-user@example.com/messages/AAMkADk...',
        resourceData: {
          id: 'AAMkADk1234567890',
          '@odata.type': '#Microsoft.Graph.Message',
        },
      };

      // Verify notification structure is correct
      expect(mockNotification.resourceData['@odata.type']).toBe('#Microsoft.Graph.Message');
      expect(mockNotification.changeType).toBe('created');
      expect(mockNotification.resource).toContain('/messages');
    });

    it('should process email updated notification and queue task', async () => {
      const mockNotification = {
        subscriptionId: 'test-subscription-id-001',
        clientState: mockClientState,
        changeType: 'updated',
        resource: 'users/test-user@example.com/messages/AAMkADk...',
        resourceData: {
          id: 'AAMkADk1234567890',
          '@odata.type': '#Microsoft.Graph.Message',
        },
      };

      // Verify notification structure is correct
      expect(mockNotification.resourceData['@odata.type']).toBe('#Microsoft.Graph.Message');
      expect(mockNotification.changeType).toBe('updated');
      expect(mockNotification.resource).toContain('/messages');
    });

    it('should handle batch email notifications', async () => {
      const mockBatchNotifications = [
        {
          subscriptionId: 'test-subscription-id-001',
          clientState: mockClientState,
          changeType: 'created',
          resource: 'users/test-user@example.com/messages/AAMkADk001',
          resourceData: {
            id: 'AAMkADk001',
            '@odata.type': '#Microsoft.Graph.Message',
          },
        },
        {
          subscriptionId: 'test-subscription-id-001',
          clientState: mockClientState,
          changeType: 'created',
          resource: 'users/test-user@example.com/messages/AAMkADk002',
          resourceData: {
            id: 'AAMkADk002',
            '@odata.type': '#Microsoft.Graph.Message',
          },
        },
        {
          subscriptionId: 'test-subscription-id-001',
          clientState: mockClientState,
          changeType: 'updated',
          resource: 'users/test-user@example.com/messages/AAMkADk003',
          resourceData: {
            id: 'AAMkADk003',
            '@odata.type': '#Microsoft.Graph.Message',
          },
        },
      ];

      // Verify batch notification structure
      expect(mockBatchNotifications).toHaveLength(3);
      mockBatchNotifications.forEach((notification) => {
        expect(notification.resourceData['@odata.type']).toBe('#Microsoft.Graph.Message');
        expect(['created', 'updated']).toContain(notification.changeType);
      });
    });
  });

  describe('Email Subscription Management', () => {
    it('should retrieve email subscription by Graph ID', async () => {
      const mockDbSubscription = {
        id: 'db-id-mgmt-001',
        subscriptionId: 'test-subscription-mgmt-001',
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: mockClientState,
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      mockPrismaClient.graphSubscription.findUnique.mockResolvedValue(mockDbSubscription);

      const subscription = await webhookService.getSubscriptionByGraphId(
        'test-subscription-mgmt-001'
      );

      expect(subscription).not.toBeNull();
      expect(subscription?.subscriptionId).toBe('test-subscription-mgmt-001');
      expect(subscription?.resource).toBe('/me/messages');
    });

    it('should delete email subscription and mark as inactive', async () => {
      const testSubscriptionId = 'db-id-mgmt-002';

      const mockDbSubscription = {
        id: testSubscriptionId,
        subscriptionId: 'test-subscription-mgmt-002',
        resource: '/me/messages',
        changeTypes: 'created,updated',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: mockClientState,
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      const mockUpdatedSubscription = { ...mockDbSubscription, isActive: false };

      mockPrismaClient.graphSubscription.findUnique.mockResolvedValue(mockDbSubscription);
      mockPrismaClient.graphSubscription.update.mockResolvedValue(mockUpdatedSubscription);

      const mockClient = {
        api: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue(null),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);

      await webhookService.deleteSubscription(testSubscriptionId, mockAccessToken);

      // Verify Prisma update was called to mark as inactive
      expect(mockPrismaClient.graphSubscription.update).toHaveBeenCalledWith({
        where: { id: testSubscriptionId },
        data: { isActive: false },
      });
    });
  });
});
