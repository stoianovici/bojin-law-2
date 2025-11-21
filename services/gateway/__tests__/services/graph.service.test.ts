/**
 * Unit Tests for Microsoft Graph API Service
 * Story 2.5: Microsoft Graph API Integration Foundation
 *
 * Tests GraphService methods for user-delegated and application-level operations
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.AZURE_AD_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_TENANT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-12345678901234567890';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

import { GraphService } from '../../src/services/graph.service';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

// Mock MSAL
jest.mock('@azure/msal-node');

// Mock Graph Client
jest.mock('@microsoft/microsoft-graph-client', () => {
  const mockApi = jest.fn();
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockTop = jest.fn();
  const mockOrderby = jest.fn();

  return {
    Client: {
      init: jest.fn(() => ({
        api: mockApi.mockReturnValue({
          get: mockGet,
          post: mockPost,
          top: mockTop.mockReturnValue({
            orderby: mockOrderby.mockReturnValue({
              get: mockGet,
            }),
            get: mockGet,
          }),
          orderby: mockOrderby.mockReturnValue({
            get: mockGet,
          }),
        }),
      })),
    },
    __mockApi: mockApi,
    __mockGet: mockGet,
    __mockPost: mockPost,
    __mockTop: mockTop,
    __mockOrderby: mockOrderby,
  };
});

describe('GraphService', () => {
  let graphService: GraphService;
  let mockMsalClient: jest.Mocked<ConfidentialClientApplication>;

  // Store original environment
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    process.env = { ...originalEnv };
    process.env.SKIP_AUTH_VALIDATION = 'true';
    process.env.SKIP_GRAPH_VALIDATION = 'true';

    // Create mock MSAL client
    mockMsalClient = {
      acquireTokenByClientCredential: jest.fn(),
      acquireTokenByRefreshToken: jest.fn(),
    } as any;

    graphService = new GraphService(mockMsalClient);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAuthenticatedClient', () => {
    it('should create Graph client with provided access token', () => {
      const accessToken = 'test-access-token';

      const client = graphService.getAuthenticatedClient(accessToken);

      expect(client).toBeDefined();
      expect(Client.init).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultVersion: 'v1.0',
        })
      );
    });

    it('should enable debug logging in development environment', () => {
      process.env.NODE_ENV = 'development';

      const accessToken = 'test-access-token';
      const client = graphService.getAuthenticatedClient(accessToken);

      expect(Client.init).toHaveBeenCalledWith(
        expect.objectContaining({
          debugLogging: true,
        })
      );
    });

    it('should disable debug logging in production environment', () => {
      process.env.NODE_ENV = 'production';

      const accessToken = 'test-access-token';
      const client = graphService.getAuthenticatedClient(accessToken);

      expect(Client.init).toHaveBeenCalledWith(
        expect.objectContaining({
          debugLogging: false,
        })
      );
    });
  });

  describe('getAppClient', () => {
    it('should acquire app-only token and create Graph client', async () => {
      mockMsalClient.acquireTokenByClientCredential.mockResolvedValue({
        accessToken: 'app-only-token',
        expiresOn: new Date(),
      } as any);

      const client = await graphService.getAppClient();

      expect(mockMsalClient.acquireTokenByClientCredential).toHaveBeenCalledWith({
        scopes: ['https://graph.microsoft.com/.default'],
      });
      expect(client).toBeDefined();
    });

    it('should throw error if token acquisition fails', async () => {
      mockMsalClient.acquireTokenByClientCredential.mockResolvedValue(null as any);

      await expect(graphService.getAppClient()).rejects.toThrow(
        'Failed to acquire app-only access token from Azure AD'
      );
    });

    it('should throw error if MSAL throws', async () => {
      mockMsalClient.acquireTokenByClientCredential.mockRejectedValue(new Error('MSAL error'));

      await expect(graphService.getAppClient()).rejects.toThrow(
        'Failed to initialize app-only Graph client: MSAL error'
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const refreshToken = 'test-refresh-token';
      const newAccessToken = 'new-access-token';
      const expiresOn = new Date(Date.now() + 3600000);

      mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue({
        accessToken: newAccessToken,
        expiresOn,
      } as any);

      const result = await graphService.refreshAccessToken(refreshToken);

      expect(mockMsalClient.acquireTokenByRefreshToken).toHaveBeenCalledWith({
        refreshToken,
        scopes: expect.arrayContaining(['User.Read']),
      });
      expect(result.accessToken).toBe(newAccessToken);
      expect(result.expiresOn).toEqual(expiresOn);
    });

    it('should use default expiry if not provided', async () => {
      const refreshToken = 'test-refresh-token';

      mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue({
        accessToken: 'new-token',
        expiresOn: undefined,
      } as any);

      const result = await graphService.refreshAccessToken(refreshToken);

      expect(result.expiresOn).toBeInstanceOf(Date);
    });

    it('should throw error if refresh fails', async () => {
      const refreshToken = 'test-refresh-token';

      mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue(null as any);

      await expect(graphService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Failed to refresh access token'
      );
    });

    it('should throw error if MSAL throws', async () => {
      mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(new Error('Token expired'));

      await expect(graphService.refreshAccessToken('token')).rejects.toThrow(
        'Token refresh failed: Token expired'
      );
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile from Graph API', async () => {
      const accessToken = 'test-token';
      const mockUser = {
        id: 'user123',
        displayName: 'Test User',
        mail: 'test@example.com',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockUser);

      const result = await graphService.getUserProfile(accessToken);

      expect(result).toEqual(mockUser);
    });

    it('should throw error if Graph API call fails', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockRejectedValue(new Error('Graph API error'));

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow(
        'Failed to fetch user profile'
      );
    });
  });

  describe('getUserById', () => {
    it('should fetch user by ID with delegated token', async () => {
      const accessToken = 'test-token';
      const userId = 'user123';
      const mockUser = {
        id: userId,
        displayName: 'Test User',
        mail: 'test@example.com',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockUser);

      const result = await graphService.getUserById(userId, accessToken);

      expect(result).toEqual(mockUser);
    });

    it('should fetch user by ID with app-only token', async () => {
      const userId = 'user123';
      const mockUser = {
        id: userId,
        displayName: 'Test User',
        mail: 'test@example.com',
      };

      mockMsalClient.acquireTokenByClientCredential.mockResolvedValue({
        accessToken: 'app-token',
        expiresOn: new Date(),
      } as any);

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockUser);

      const result = await graphService.getUserById(userId);

      expect(result).toEqual(mockUser);
    });
  });

  describe('listMessages', () => {
    it('should list messages with default top 10', async () => {
      const accessToken = 'test-token';
      const mockMessages = {
        value: [
          { id: 'msg1', subject: 'Test 1' },
          { id: 'msg2', subject: 'Test 2' },
        ],
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockMessages);

      const result = await graphService.listMessages(accessToken);

      expect(result).toEqual(mockMessages.value);
    });

    it('should list messages with custom top parameter', async () => {
      const accessToken = 'test-token';
      const mockMessages = {
        value: [{ id: 'msg1', subject: 'Test' }],
      };

      const { __mockGet, __mockTop } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockMessages);

      const result = await graphService.listMessages(accessToken, 5);

      expect(__mockTop).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockMessages.value);
    });
  });

  describe('getMessageById', () => {
    it('should fetch message by ID', async () => {
      const accessToken = 'test-token';
      const messageId = 'msg123';
      const mockMessage = {
        id: messageId,
        subject: 'Test Message',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockMessage);

      const result = await graphService.getMessageById(accessToken, messageId);

      expect(result).toEqual(mockMessage);
    });
  });

  describe('sendMail', () => {
    it('should send email via Graph API', async () => {
      const accessToken = 'test-token';
      const message = {
        subject: 'Test Email',
        body: {
          contentType: 'Text' as const,
          content: 'Test body',
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'recipient@example.com',
            },
          },
        ],
      };

      const { __mockPost } = require('@microsoft/microsoft-graph-client');
      __mockPost.mockResolvedValue(undefined);

      await graphService.sendMail(accessToken, message);

      expect(__mockPost).toHaveBeenCalledWith({
        message,
        saveToSentItems: true,
      });
    });

    it('should throw error if send fails', async () => {
      const accessToken = 'test-token';
      const message = {
        subject: 'Test',
        body: { contentType: 'Text' as const, content: 'Body' },
        toRecipients: [{ emailAddress: { address: 'test@example.com' } }],
      };

      const { __mockPost } = require('@microsoft/microsoft-graph-client');
      __mockPost.mockRejectedValue(new Error('Send failed'));

      await expect(graphService.sendMail(accessToken, message)).rejects.toThrow(
        'Failed to send email'
      );
    });
  });

  describe('getDriveRoot', () => {
    it('should fetch drive root metadata', async () => {
      const accessToken = 'test-token';
      const mockDriveRoot = {
        id: 'root-id',
        name: 'root',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockDriveRoot);

      const result = await graphService.getDriveRoot(accessToken);

      expect(result).toEqual(mockDriveRoot);
    });
  });

  describe('getDriveItem', () => {
    it('should fetch drive item by ID', async () => {
      const accessToken = 'test-token';
      const itemId = 'item123';
      const mockDriveItem = {
        id: itemId,
        name: 'document.pdf',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockDriveItem);

      const result = await graphService.getDriveItem(accessToken, itemId);

      expect(result).toEqual(mockDriveItem);
    });
  });

  describe('listCalendarEvents', () => {
    it('should list calendar events with default top 10', async () => {
      const accessToken = 'test-token';
      const mockEvents = {
        value: [
          { id: 'event1', subject: 'Meeting 1' },
          { id: 'event2', subject: 'Meeting 2' },
        ],
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockEvents);

      const result = await graphService.listCalendarEvents(accessToken);

      expect(result).toEqual(mockEvents.value);
    });

    it('should list calendar events with custom top parameter', async () => {
      const accessToken = 'test-token';
      const mockEvents = {
        value: [{ id: 'event1', subject: 'Meeting' }],
      };

      const { __mockGet, __mockTop } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockEvents);

      const result = await graphService.listCalendarEvents(accessToken, 20);

      expect(__mockTop).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockEvents.value);
    });
  });

  describe('getCalendarEventById', () => {
    it('should fetch calendar event by ID', async () => {
      const accessToken = 'test-token';
      const eventId = 'event123';
      const mockEvent = {
        id: eventId,
        subject: 'Test Meeting',
      };

      const { __mockGet } = require('@microsoft/microsoft-graph-client');
      __mockGet.mockResolvedValue(mockEvent);

      const result = await graphService.getCalendarEventById(accessToken, eventId);

      expect(result).toEqual(mockEvent);
    });
  });
});
