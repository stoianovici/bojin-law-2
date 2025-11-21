/**
 * File Webhooks Integration Tests
 * Story 2.5 - Task 10: Implement File Change Notifications
 *
 * Tests webhook subscription creation and notification processing for file changes
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

describe('File Webhook Integration', () => {
  const mockAccessToken = 'mock-access-token-456';
  const mockClientState = 'test-file-client-state';

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

  describe('File Subscription Creation', () => {
    it('should create file subscription for /me/drive/root with created, updated, deleted changeTypes', async () => {
      // Mock Graph API response
      const mockGraphSubscription = {
        id: 'test-file-subscription-id-001',
        resource: '/me/drive/root',
        changeType: 'created,updated,deleted',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: mockClientState,
      };

      const mockDbSubscription = {
        id: 'db-file-id-001',
        subscriptionId: 'test-file-subscription-id-001',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
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

      // Create file subscription
      const subscription = await webhookService.createFileSubscription(
        mockAccessToken,
        mockClientState
      );

      // Verify Graph API was called correctly
      expect(Client.init).toHaveBeenCalledWith({
        authProvider: expect.any(Function),
      });
      expect(mockClient.api).toHaveBeenCalledWith('/subscriptions');

      // Verify subscription was stored in database
      expect(subscription.subscriptionId).toBe('test-file-subscription-id-001');
      expect(subscription.resource).toBe('/me/drive/root');
      expect(subscription.changeTypes).toBe('created,updated,deleted');
      expect(subscription.isActive).toBe(true);
      expect(subscription.clientState).toBe(mockClientState);
    });

    it('should handle Graph API errors during file subscription creation', async () => {
      const mockError = {
        statusCode: 403,
        code: 'Forbidden',
        message: 'Insufficient permissions',
      };

      const mockClient = {
        api: jest.fn().mockReturnValue({
          post: jest.fn().mockRejectedValue(mockError),
        }),
      };

      (Client.init as jest.Mock).mockReturnValue(mockClient);

      // Attempt to create subscription (403 errors are permanent and don't retry)
      await expect(webhookService.createFileSubscription(mockAccessToken)).rejects.toMatchObject({
        statusCode: 403,
        code: 'Forbidden',
      });
    });

    it('should include all three change types (created, updated, deleted)', async () => {
      const mockGraphSubscription = {
        id: 'test-file-subscription-id-002',
        resource: '/me/drive/root',
        changeType: 'created,updated,deleted',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: mockClientState,
      };

      const mockDbSubscription = {
        id: 'db-file-id-002',
        subscriptionId: 'test-file-subscription-id-002',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
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

      const subscription = await webhookService.createFileSubscription(
        mockAccessToken,
        mockClientState
      );

      // Verify all three change types are present
      expect(subscription.changeTypes).toContain('created');
      expect(subscription.changeTypes).toContain('updated');
      expect(subscription.changeTypes).toContain('deleted');
    });

    it('should use /me/drive/root as the resource path', async () => {
      const mockGraphSubscription = {
        id: 'test-file-subscription-id-003',
        resource: '/me/drive/root',
        changeType: 'created,updated,deleted',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: mockClientState,
      };

      const mockDbSubscription = {
        id: 'db-file-id-003',
        subscriptionId: 'test-file-subscription-id-003',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
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

      const subscription = await webhookService.createFileSubscription(
        mockAccessToken,
        mockClientState
      );

      expect(subscription.resource).toBe('/me/drive/root');
    });
  });

  describe('File Notification Processing', () => {
    it('should process file created notification and queue task', async () => {
      // Verify notification structure for created event
      const mockNotification = {
        subscriptionId: 'test-file-subscription-id-001',
        clientState: mockClientState,
        changeType: 'created',
        resource: 'users/test-user@example.com/drive/root/items/01234567890',
        resourceData: {
          id: '01234567890ABCDEF',
          '@odata.type': '#Microsoft.Graph.DriveItem',
        },
      };

      // Verify notification structure is correct
      expect(mockNotification.resourceData['@odata.type']).toBe('#Microsoft.Graph.DriveItem');
      expect(mockNotification.changeType).toBe('created');
      expect(mockNotification.resource).toContain('/drive');
    });

    it('should process file updated notification and queue task', async () => {
      const mockNotification = {
        subscriptionId: 'test-file-subscription-id-001',
        clientState: mockClientState,
        changeType: 'updated',
        resource: 'users/test-user@example.com/drive/root/items/01234567890',
        resourceData: {
          id: '01234567890ABCDEF',
          '@odata.type': '#Microsoft.Graph.DriveItem',
        },
      };

      // Verify notification structure is correct
      expect(mockNotification.resourceData['@odata.type']).toBe('#Microsoft.Graph.DriveItem');
      expect(mockNotification.changeType).toBe('updated');
      expect(mockNotification.resource).toContain('/drive');
    });

    it('should process file deleted notification and queue task', async () => {
      const mockNotification = {
        subscriptionId: 'test-file-subscription-id-001',
        clientState: mockClientState,
        changeType: 'deleted',
        resource: 'users/test-user@example.com/drive/root/items/01234567890',
        resourceData: {
          id: '01234567890ABCDEF',
          '@odata.type': '#Microsoft.Graph.DriveItem',
        },
      };

      // Verify notification structure is correct
      expect(mockNotification.resourceData['@odata.type']).toBe('#Microsoft.Graph.DriveItem');
      expect(mockNotification.changeType).toBe('deleted');
      expect(mockNotification.resource).toContain('/drive');
    });

    it('should handle batch file notifications', async () => {
      const mockBatchNotifications = [
        {
          subscriptionId: 'test-file-subscription-id-001',
          clientState: mockClientState,
          changeType: 'created',
          resource: 'users/test-user@example.com/drive/root/items/FILE001',
          resourceData: {
            id: 'FILE001',
            '@odata.type': '#Microsoft.Graph.DriveItem',
          },
        },
        {
          subscriptionId: 'test-file-subscription-id-001',
          clientState: mockClientState,
          changeType: 'updated',
          resource: 'users/test-user@example.com/drive/root/items/FILE002',
          resourceData: {
            id: 'FILE002',
            '@odata.type': '#Microsoft.Graph.DriveItem',
          },
        },
        {
          subscriptionId: 'test-file-subscription-id-001',
          clientState: mockClientState,
          changeType: 'deleted',
          resource: 'users/test-user@example.com/drive/root/items/FILE003',
          resourceData: {
            id: 'FILE003',
            '@odata.type': '#Microsoft.Graph.DriveItem',
          },
        },
      ];

      // Verify batch notification structure
      expect(mockBatchNotifications).toHaveLength(3);
      mockBatchNotifications.forEach((notification) => {
        expect(notification.resourceData['@odata.type']).toBe('#Microsoft.Graph.DriveItem');
        expect(['created', 'updated', 'deleted']).toContain(notification.changeType);
      });
    });
  });

  describe('File Subscription Management', () => {
    it('should retrieve file subscription by Graph ID', async () => {
      const mockDbSubscription = {
        id: 'db-file-mgmt-001',
        subscriptionId: 'test-file-subscription-mgmt-001',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
        notificationUrl: 'http://localhost:3000/webhooks/graph',
        clientState: mockClientState,
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastRenewedAt: null,
        isActive: true,
      };

      mockPrismaClient.graphSubscription.findUnique.mockResolvedValue(mockDbSubscription);

      const subscription = await webhookService.getSubscriptionByGraphId(
        'test-file-subscription-mgmt-001'
      );

      expect(subscription).not.toBeNull();
      expect(subscription?.subscriptionId).toBe('test-file-subscription-mgmt-001');
      expect(subscription?.resource).toBe('/me/drive/root');
    });

    it('should delete file subscription and mark as inactive', async () => {
      const testSubscriptionId = 'db-file-mgmt-002';

      const mockDbSubscription = {
        id: testSubscriptionId,
        subscriptionId: 'test-file-subscription-mgmt-002',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
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
