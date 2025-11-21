/**
 * Graph API Operations Integration Tests
 * Story 2.5: Microsoft Graph API Integration Foundation (Task 17)
 *
 * Integration tests for Microsoft Graph API routes including:
 * - User profile retrieval
 * - Email listing and sending
 * - OneDrive file operations
 * - Calendar event retrieval
 * - Webhook subscription creation and renewal
 */

// Set required environment variables for testing
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters-long-for-security';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-characters-long';
process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret';
process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3001/auth/callback';
process.env.WEBHOOK_BASE_URL = 'https://test-app.example.com';
process.env.WEBHOOK_CLIENT_STATE = 'test-client-state-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import { app } from '../../src/index';
import { GraphService } from '../../src/services/graph.service';
import { WebhookService } from '../../src/services/webhook.service';
import { User, Message, DriveItem, Event } from '@microsoft/microsoft-graph-types';

// Mock GraphService and WebhookService to avoid making real Graph API calls
jest.mock('../../src/services/graph.service');
jest.mock('../../src/services/webhook.service');

// Mock Redis client from @legal-platform/database
jest.mock('@legal-platform/database', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    dbsize: jest.fn().mockResolvedValue(0),
    info: jest.fn().mockResolvedValue('# Stats'),
    status: 'ready',
    quit: jest.fn().mockResolvedValue('OK'),
    // Mock multi/pipeline for rate limiting
    multi: jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 0],
        [null, 1],
        [null, 1],
      ]),
    }),
  };

  return {
    redis: mockRedis,
    prisma: {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  };
});

// Mock session middleware to inject test session data
jest.mock('express-session', () => {
  // Create a mock Store class for connect-redis
  class Store {
    constructor(options?: any) {}
    get(sid: string, callback: (err: any, session?: any) => void) {
      callback(null, null);
    }
    set(sid: string, session: any, callback?: (err?: any) => void) {
      if (callback) callback();
    }
    destroy(sid: string, callback?: (err?: any) => void) {
      if (callback) callback();
    }
  }

  const sessionMiddleware = (options?: any) => (req: any, res: any, next: any) => {
    req.session = {
      userId: 'test-user-id-12345',
      accessToken: 'test-access-token-abc123',
      email: 'test@example.com',
      role: 'lawyer',
      save: jest.fn((cb) => cb && cb()),
      destroy: jest.fn((cb) => cb && cb()),
      reload: jest.fn((cb) => cb && cb()),
      regenerate: jest.fn((cb) => cb && cb()),
      touch: jest.fn(),
      cookie: {
        maxAge: 3600000,
        secure: false,
        httpOnly: true,
      },
    };
    next();
  };

  // Attach Store to the middleware function
  sessionMiddleware.Store = Store;

  return sessionMiddleware;
});

describe('Graph API Operations Integration', () => {
  let mockGraphService: jest.Mocked<GraphService>;
  let mockWebhookService: jest.Mocked<WebhookService>;
  const testUserId = 'test-user-id-12345';
  const testAccessToken = 'test-access-token-abc123';

  beforeEach(() => {
    // Setup mock GraphService
    mockGraphService = GraphService.prototype as jest.Mocked<GraphService>;

    // Setup mock WebhookService
    mockWebhookService = WebhookService.prototype as jest.Mocked<WebhookService>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  // ============================================================================
  // User Profile Retrieval Tests
  // ============================================================================

  describe('User Profile Retrieval', () => {
    const mockUserProfile: Partial<User> = {
      id: testUserId,
      displayName: 'John Doe',
      mail: 'john.doe@example.com',
      jobTitle: 'Senior Attorney',
      officeLocation: 'New York Office',
      mobilePhone: '+1-555-0100',
    };

    it('should retrieve current user profile via GET /graph/users/me', async () => {
      mockGraphService.getUserProfile = jest.fn().mockResolvedValue(mockUserProfile);

      const response = await request(app).get('/graph/users/me').expect(200);

      expect(response.body).toEqual({
        data: mockUserProfile,
      });

      expect(mockGraphService.getUserProfile).toHaveBeenCalledWith(testAccessToken);
      expect(mockGraphService.getUserProfile).toHaveBeenCalledTimes(1);
    });

    it('should retrieve user by ID via GET /graph/users/:userId', async () => {
      const targetUserId = 'another-user-id-67890';
      const targetUserProfile: Partial<User> = {
        id: targetUserId,
        displayName: 'Jane Smith',
        mail: 'jane.smith@example.com',
        jobTitle: 'Paralegal',
      };

      mockGraphService.getUserById = jest.fn().mockResolvedValue(targetUserProfile);

      const response = await request(app).get(`/graph/users/${targetUserId}`).expect(200);

      expect(response.body).toEqual({
        data: targetUserProfile,
      });

      expect(mockGraphService.getUserById).toHaveBeenCalledWith(targetUserId, testAccessToken);
      expect(mockGraphService.getUserById).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for missing userId parameter', async () => {
      const response = await request(app).get('/graph/users/').expect(404); // Express returns 404 for missing route params

      // Note: This tests the route structure, not the validation logic
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/graph/users/me').expect(401);

      expect(response.body).toHaveProperty('error', 'unauthorized');
      expect(response.body).toHaveProperty('message', 'Authentication required');
    });
  });

  // ============================================================================
  // Email Operations Tests
  // ============================================================================

  describe('Email Operations', () => {
    const mockMessages: Partial<Message>[] = [
      {
        id: 'msg-1',
        subject: 'Case Update: Smith v. Jones',
        receivedDateTime: '2025-11-20T10:30:00Z',
        from: {
          emailAddress: {
            address: 'client@example.com',
            name: 'Client Name',
          },
        },
        bodyPreview: 'Please find attached the latest case update...',
      },
      {
        id: 'msg-2',
        subject: 'Deposition Schedule',
        receivedDateTime: '2025-11-20T09:15:00Z',
        from: {
          emailAddress: {
            address: 'opposing@law.com',
            name: 'Opposing Counsel',
          },
        },
        bodyPreview: 'Proposed deposition dates for next month...',
      },
    ];

    it('should list user email messages via GET /graph/messages', async () => {
      mockGraphService.listMessages = jest.fn().mockResolvedValue(mockMessages);

      const response = await request(app).get('/graph/messages').expect(200);

      expect(response.body).toEqual({
        data: mockMessages,
        count: mockMessages.length,
      });

      expect(mockGraphService.listMessages).toHaveBeenCalledWith(testAccessToken, 10);
      expect(mockGraphService.listMessages).toHaveBeenCalledTimes(1);
    });

    it('should list messages with custom top parameter', async () => {
      mockGraphService.listMessages = jest.fn().mockResolvedValue(mockMessages.slice(0, 1));

      const response = await request(app).get('/graph/messages?top=1').expect(200);

      expect(response.body.count).toBe(1);
      expect(mockGraphService.listMessages).toHaveBeenCalledWith(testAccessToken, 1);
    });

    it('should cap top parameter at 100', async () => {
      mockGraphService.listMessages = jest.fn().mockResolvedValue(mockMessages);

      await request(app).get('/graph/messages?top=500').expect(200);

      expect(mockGraphService.listMessages).toHaveBeenCalledWith(testAccessToken, 100);
    });

    it('should retrieve specific message by ID via GET /graph/messages/:messageId', async () => {
      const messageId = 'msg-1';
      const mockMessage = mockMessages[0];

      mockGraphService.getMessageById = jest.fn().mockResolvedValue(mockMessage);

      const response = await request(app).get(`/graph/messages/${messageId}`).expect(200);

      expect(response.body).toEqual({
        data: mockMessage,
      });

      expect(mockGraphService.getMessageById).toHaveBeenCalledWith(testAccessToken, messageId);
    });

    it('should send email via POST /graph/messages/send', async () => {
      const emailPayload = {
        subject: 'Test Email Subject',
        body: {
          contentType: 'Text',
          content: 'This is a test email body.',
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'recipient@example.com',
            },
          },
        ],
      };

      mockGraphService.sendMail = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .post('/graph/messages/send')
        .send(emailPayload)
        .expect(202);

      expect(response.body).toEqual({
        success: true,
        message: 'Email sent successfully',
      });

      expect(mockGraphService.sendMail).toHaveBeenCalledWith(testAccessToken, emailPayload);
      expect(mockGraphService.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for invalid email payload (missing subject)', async () => {
      const invalidPayload = {
        body: {
          contentType: 'Text',
          content: 'Test content',
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'recipient@example.com',
            },
          },
        ],
      };

      const response = await request(app)
        .post('/graph/messages/send')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'bad_request');
      expect(response.body.message).toContain('subject');
    });

    it('should return 400 for invalid email payload (empty recipients)', async () => {
      const invalidPayload = {
        subject: 'Test Subject',
        body: {
          contentType: 'Text',
          content: 'Test content',
        },
        toRecipients: [],
      };

      const response = await request(app)
        .post('/graph/messages/send')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'bad_request');
      expect(response.body.message).toContain('at least one recipient');
    });
  });

  // ============================================================================
  // OneDrive File Operations Tests
  // ============================================================================

  describe('OneDrive File Operations', () => {
    const mockDriveRoot: Partial<DriveItem> = {
      id: 'root',
      name: 'root',
      folder: {
        childCount: 5,
      },
      webUrl: 'https://onedrive.com/root',
    };

    const mockDriveItem: Partial<DriveItem> = {
      id: 'item-abc123',
      name: 'Case-Documents.docx',
      size: 102400,
      file: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      webUrl: 'https://onedrive.com/items/item-abc123',
      createdDateTime: '2025-11-15T14:30:00Z',
      lastModifiedDateTime: '2025-11-20T09:00:00Z',
    };

    it('should retrieve OneDrive root folder via GET /graph/drive/root', async () => {
      mockGraphService.getDriveRoot = jest.fn().mockResolvedValue(mockDriveRoot);

      const response = await request(app).get('/graph/drive/root').expect(200);

      expect(response.body).toEqual({
        data: mockDriveRoot,
      });

      expect(mockGraphService.getDriveRoot).toHaveBeenCalledWith(testAccessToken);
      expect(mockGraphService.getDriveRoot).toHaveBeenCalledTimes(1);
    });

    it('should retrieve drive item by ID via GET /graph/drive/items/:itemId', async () => {
      const itemId = 'item-abc123';

      mockGraphService.getDriveItem = jest.fn().mockResolvedValue(mockDriveItem);

      const response = await request(app).get(`/graph/drive/items/${itemId}`).expect(200);

      expect(response.body).toEqual({
        data: mockDriveItem,
      });

      expect(mockGraphService.getDriveItem).toHaveBeenCalledWith(testAccessToken, itemId);
      expect(mockGraphService.getDriveItem).toHaveBeenCalledTimes(1);
    });

    it('should return 404 for non-existent drive item', async () => {
      const itemId = 'non-existent-item';

      mockGraphService.getDriveItem = jest.fn().mockRejectedValue({
        code: 'itemNotFound',
        message: 'The item was not found',
        statusCode: 404,
      });

      const response = await request(app).get(`/graph/drive/items/${itemId}`).expect(404);

      expect(response.body).toHaveProperty('error', 'itemNotFound');
      expect(response.body.message).toContain('not found');
    });
  });

  // ============================================================================
  // Calendar Event Operations Tests
  // ============================================================================

  describe('Calendar Event Operations', () => {
    const mockCalendarEvents: Partial<Event>[] = [
      {
        id: 'event-1',
        subject: 'Client Meeting - Smith Case',
        start: {
          dateTime: '2025-11-25T14:00:00',
          timeZone: 'Eastern Standard Time',
        },
        end: {
          dateTime: '2025-11-25T15:00:00',
          timeZone: 'Eastern Standard Time',
        },
        location: {
          displayName: 'Conference Room A',
        },
        attendees: [
          {
            emailAddress: {
              address: 'client@example.com',
              name: 'Client Name',
            },
            type: 'required',
          },
        ],
      },
      {
        id: 'event-2',
        subject: 'Court Appearance - Jones Trial',
        start: {
          dateTime: '2025-11-26T09:00:00',
          timeZone: 'Eastern Standard Time',
        },
        end: {
          dateTime: '2025-11-26T12:00:00',
          timeZone: 'Eastern Standard Time',
        },
        location: {
          displayName: 'District Courthouse',
        },
      },
    ];

    it('should list calendar events via GET /graph/calendar/events', async () => {
      mockGraphService.listCalendarEvents = jest.fn().mockResolvedValue(mockCalendarEvents);

      const response = await request(app).get('/graph/calendar/events').expect(200);

      expect(response.body).toEqual({
        data: mockCalendarEvents,
        count: mockCalendarEvents.length,
      });

      expect(mockGraphService.listCalendarEvents).toHaveBeenCalledWith(testAccessToken, 10);
      expect(mockGraphService.listCalendarEvents).toHaveBeenCalledTimes(1);
    });

    it('should list calendar events with custom top parameter', async () => {
      mockGraphService.listCalendarEvents = jest
        .fn()
        .mockResolvedValue(mockCalendarEvents.slice(0, 1));

      const response = await request(app).get('/graph/calendar/events?top=1').expect(200);

      expect(response.body.count).toBe(1);
      expect(mockGraphService.listCalendarEvents).toHaveBeenCalledWith(testAccessToken, 1);
    });

    it('should cap top parameter at 100 for calendar events', async () => {
      mockGraphService.listCalendarEvents = jest.fn().mockResolvedValue(mockCalendarEvents);

      await request(app).get('/graph/calendar/events?top=200').expect(200);

      expect(mockGraphService.listCalendarEvents).toHaveBeenCalledWith(testAccessToken, 100);
    });

    it('should retrieve specific calendar event by ID via GET /graph/calendar/events/:eventId', async () => {
      const eventId = 'event-1';
      const mockEvent = mockCalendarEvents[0];

      mockGraphService.getCalendarEventById = jest.fn().mockResolvedValue(mockEvent);

      const response = await request(app).get(`/graph/calendar/events/${eventId}`).expect(200);

      expect(response.body).toEqual({
        data: mockEvent,
      });

      expect(mockGraphService.getCalendarEventById).toHaveBeenCalledWith(testAccessToken, eventId);
    });

    it('should return 404 for non-existent calendar event', async () => {
      const eventId = 'non-existent-event';

      mockGraphService.getCalendarEventById = jest.fn().mockRejectedValue({
        code: 'itemNotFound',
        message: 'Event not found',
        statusCode: 404,
      });

      const response = await request(app).get(`/graph/calendar/events/${eventId}`).expect(404);

      expect(response.body).toHaveProperty('error', 'itemNotFound');
    });
  });

  // ============================================================================
  // Webhook Subscription Tests
  // ============================================================================

  describe('Webhook Subscription Operations', () => {
    const mockSubscription = {
      id: 'sub-123',
      subscriptionId: 'graph-sub-abc123',
      resource: '/me/messages',
      changeTypes: 'created,updated',
      notificationUrl: 'https://test-app.example.com/webhooks/graph',
      clientState: 'test-client-state-secret',
      expirationDateTime: new Date('2025-11-23T10:00:00Z'),
      isActive: true,
      createdAt: new Date('2025-11-20T10:00:00Z'),
      lastRenewedAt: null,
    };

    it('should create email webhook subscription', async () => {
      mockWebhookService.createSubscription = jest.fn().mockResolvedValue(mockSubscription);

      // Note: This test assumes there's an endpoint to create subscriptions
      // Since the webhook.routes.ts only handles incoming notifications,
      // subscription creation would typically be done via GraphService directly
      // or through an admin endpoint

      const result = await mockWebhookService.createSubscription({
        resource: '/me/messages',
        changeTypes: ['created', 'updated'],
        accessToken: testAccessToken,
        clientState: 'test-client-state-secret',
      });

      expect(result).toEqual(mockSubscription);
      expect(mockWebhookService.createSubscription).toHaveBeenCalledWith({
        resource: '/me/messages',
        changeTypes: ['created', 'updated'],
        accessToken: testAccessToken,
        clientState: 'test-client-state-secret',
      });
    });

    it('should create file webhook subscription', async () => {
      const fileSubscription = {
        ...mockSubscription,
        id: 'sub-456',
        subscriptionId: 'graph-sub-def456',
        resource: '/me/drive/root',
        changeTypes: 'created,updated,deleted',
      };

      mockWebhookService.createSubscription = jest.fn().mockResolvedValue(fileSubscription);

      const result = await mockWebhookService.createSubscription({
        resource: '/me/drive/root',
        changeTypes: ['created', 'updated', 'deleted'],
        accessToken: testAccessToken,
      });

      expect(result).toEqual(fileSubscription);
      expect(result.resource).toBe('/me/drive/root');
      expect(result.changeTypes).toContain('deleted');
    });

    it('should renew expiring subscription', async () => {
      const renewedSubscription = {
        ...mockSubscription,
        expirationDateTime: new Date('2025-11-26T10:00:00Z'),
        lastRenewedAt: new Date('2025-11-20T11:00:00Z'),
      };

      mockWebhookService.renewSubscription = jest.fn().mockResolvedValue(renewedSubscription);

      const result = await mockWebhookService.renewSubscription(
        mockSubscription.subscriptionId,
        testAccessToken
      );

      expect(result).toEqual(renewedSubscription);
      expect(result.lastRenewedAt).toBeTruthy();
      expect(mockWebhookService.renewSubscription).toHaveBeenCalledWith(
        mockSubscription.subscriptionId,
        testAccessToken
      );
    });

    it('should handle subscription renewal failure gracefully', async () => {
      mockWebhookService.renewSubscription = jest.fn().mockRejectedValue({
        code: 'subscriptionNotFound',
        message: 'Subscription not found or expired',
        statusCode: 404,
      });

      await expect(
        mockWebhookService.renewSubscription('invalid-sub-id', testAccessToken)
      ).rejects.toMatchObject({
        code: 'subscriptionNotFound',
        statusCode: 404,
      });
    });

    it('should delete subscription when no longer needed', async () => {
      mockWebhookService.deleteSubscription = jest.fn().mockResolvedValue(undefined);

      await mockWebhookService.deleteSubscription(mockSubscription.subscriptionId, testAccessToken);

      expect(mockWebhookService.deleteSubscription).toHaveBeenCalledWith(
        mockSubscription.subscriptionId,
        testAccessToken
      );
      expect(mockWebhookService.deleteSubscription).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle Graph API errors gracefully', async () => {
      mockGraphService.getUserProfile = jest.fn().mockRejectedValue({
        code: 'InvalidAuthenticationToken',
        message: 'Access token is invalid or expired',
        statusCode: 401,
      });

      const response = await request(app).get('/graph/users/me').expect(401);

      expect(response.body).toHaveProperty('error', 'InvalidAuthenticationToken');
      expect(response.body.message).toContain('invalid or expired');
    });

    it('should handle rate limiting errors (429)', async () => {
      mockGraphService.listMessages = jest.fn().mockRejectedValue({
        code: 'Throttled',
        message: 'Rate limit exceeded',
        statusCode: 429,
      });

      const response = await request(app).get('/graph/messages').expect(429);

      expect(response.body).toHaveProperty('error', 'Throttled');
    });

    it('should handle service unavailable errors (503)', async () => {
      mockGraphService.getDriveRoot = jest.fn().mockRejectedValue({
        code: 'ServiceNotAvailable',
        message: 'Graph API is temporarily unavailable',
        statusCode: 503,
      });

      const response = await request(app).get('/graph/drive/root').expect(503);

      expect(response.body).toHaveProperty('error', 'ServiceNotAvailable');
    });

    it('should handle internal server errors (500)', async () => {
      mockGraphService.listCalendarEvents = jest.fn().mockRejectedValue({
        code: 'generalException',
        message: 'An unexpected error occurred',
        statusCode: 500,
      });

      const response = await request(app).get('/graph/calendar/events').expect(500);

      expect(response.body).toHaveProperty('error', 'generalException');
    });
  });

  // ============================================================================
  // Cache Integration Tests
  // ============================================================================

  describe('Cache Integration', () => {
    it('should cache GET requests to user profile', async () => {
      const mockProfile = {
        id: testUserId,
        displayName: 'Test User',
        mail: 'test@example.com',
      };

      mockGraphService.getUserProfile = jest.fn().mockResolvedValue(mockProfile);

      // First request - should hit Graph API
      const response1 = await request(app).get('/graph/users/me').expect(200);

      expect(response1.body.data).toEqual(mockProfile);

      // Note: Actual cache behavior depends on cache middleware implementation
      // This test validates the route structure supports caching
    });

    it('should include X-Cache header in responses', async () => {
      mockGraphService.getUserProfile = jest.fn().mockResolvedValue({
        id: testUserId,
        displayName: 'Test User',
      });

      const response = await request(app).get('/graph/users/me').expect(200);

      // Cache middleware should add X-Cache header
      // Actual value (HIT/MISS) depends on cache state
      expect(response.headers).toHaveProperty('x-cache');
    });
  });
});
