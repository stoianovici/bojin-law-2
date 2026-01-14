/**
 * Microsoft Graph API Service
 * Story 2.5: Microsoft Graph API Integration Foundation
 *
 * Service layer for Microsoft Graph API operations with authentication provider integration.
 * Supports both user-delegated and application-level API calls.
 *
 * Ref: Microsoft Graph SDK - https://github.com/microsoftgraph/msgraph-sdk-javascript
 * Ref: Graph API documentation - https://learn.microsoft.com/en-us/graph/api/overview
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type {
  User,
  Message,
  DriveItem,
  Event,
  MailFolder,
  DirectoryObject,
  Group,
} from '@microsoft/microsoft-graph-types';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { azureAdConfig, msalConfig } from '../config/auth.config';
import { graphConfig, graphEndpoints, graphScopes } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';

// Note: Client.init() expects authProvider as a callback function: (done) => done(null, token)
// Client.initWithMiddleware() expects an AuthenticationProvider instance with getAccessToken()
// We use Client.init() with callback pattern for simplicity

/**
 * Microsoft Graph API Service
 * Handles all interactions with Microsoft Graph API
 */
export class GraphService {
  private msalClient: ConfidentialClientApplication;

  /**
   * Create GraphService instance
   *
   * @param msalClient - Optional MSAL client (for testing)
   */
  constructor(msalClient?: ConfidentialClientApplication) {
    this.msalClient = msalClient || new ConfidentialClientApplication(msalConfig);
  }

  /**
   * Get authenticated Graph client for user-delegated scenarios
   *
   * Uses the provided access token to make Graph API calls on behalf of a user.
   * The access token must have the necessary delegated permissions.
   *
   * @param accessToken - OAuth access token with Graph API delegated permissions
   * @returns Configured Microsoft Graph client instance
   */
  getAuthenticatedClient(accessToken: string): Client {
    // Client.init() expects authProvider as a callback function, not an object
    // The callback receives (done) and must call done(error, token)
    return Client.init({
      defaultVersion: 'v1.0',
      debugLogging: process.env.NODE_ENV === 'development',
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * Get Graph client for application-level scenarios
   *
   * Uses client credentials flow to obtain an app-only access token.
   * Requires application permissions configured in Azure AD.
   * Ideal for background tasks that don't run in a user context.
   *
   * @returns Configured Microsoft Graph client instance with app-only auth
   * @throws Error if client credentials flow fails
   */
  async getAppClient(): Promise<Client> {
    try {
      // Acquire token using client credentials flow
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: graphScopes.default, // https://graph.microsoft.com/.default
      });

      if (!result?.accessToken) {
        throw new Error('Failed to acquire app-only access token from Azure AD');
      }

      const accessToken = result.accessToken;

      // Client.init() expects authProvider as a callback function, not an object
      return Client.init({
        defaultVersion: 'v1.0',
        debugLogging: process.env.NODE_ENV === 'development',
        authProvider: (done) => {
          done(null, accessToken);
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to initialize app-only Graph client: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   *
   * Uses the refresh token to obtain a new access token without requiring
   * user interaction. This is called automatically when a 401 Unauthorized
   * error is received from Graph API.
   *
   * @param refreshToken - Refresh token from initial authentication
   * @returns New access token and expiration
   * @throws Error if token refresh fails
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresOn: Date;
  }> {
    try {
      const result = await this.msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: graphScopes.delegated.all,
      });

      if (!result?.accessToken) {
        throw new Error('Failed to refresh access token - no token returned');
      }

      return {
        accessToken: result.accessToken,
        expiresOn: result.expiresOn || new Date(Date.now() + 3600 * 1000), // Default 1 hour
      };
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get current user profile (delegated)
   *
   * Retrieves the profile of the authenticated user.
   * Requires User.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @returns User profile from Microsoft Graph
   * @throws Error if Graph API call fails
   */
  async getUserProfile(accessToken: string): Promise<User> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const user = await client.api(graphEndpoints.me).get();

          return user as User;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-user-profile'
    );
  }

  /**
   * Get user by ID (application or delegated)
   *
   * Retrieves a specific user's profile by their ID.
   * Requires User.Read.All application permission or User.ReadBasic.All delegated permission.
   *
   * @param userId - Azure AD user ID
   * @param accessToken - Access token (delegated) or undefined for app-only
   * @returns User profile from Microsoft Graph
   * @throws Error if Graph API call fails
   */
  async getUserById(userId: string, accessToken?: string): Promise<User> {
    return retryWithBackoff(
      async () => {
        try {
          const client = accessToken
            ? this.getAuthenticatedClient(accessToken)
            : await this.getAppClient();

          const user = await client.api(graphEndpoints.userById(userId)).get();

          return user as User;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-user-by-id'
    );
  }

  /**
   * List user messages (delegated)
   *
   * Retrieves a list of messages in the user's mailbox.
   * Requires Mail.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @param top - Number of messages to retrieve (default: 10, max: 999)
   * @returns Array of email messages
   * @throws Error if Graph API call fails
   */
  async listMessages(accessToken: string, top: number = 10): Promise<Message[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const response = await client
            .api(graphEndpoints.messages)
            .top(top)
            .orderby('receivedDateTime DESC')
            .get();

          return response.value as Message[];
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-list-messages'
    );
  }

  /**
   * Get mail folders (delegated)
   *
   * Retrieves the list of mail folders in the user's mailbox.
   * Includes well-known folders (Inbox, Sent Items, Drafts, etc.) and custom folders.
   * Optionally fetches child folders recursively.
   * Requires Mail.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @param includeChildren - Whether to recursively fetch child folders (default: true)
   * @returns Array of mail folders with nested children if requested
   * @throws Error if Graph API call fails
   */
  async getMailFolders(
    accessToken: string,
    includeChildren: boolean = true
  ): Promise<MailFolder[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          // Fetch top-level folders
          const response = await client.api(graphEndpoints.mailFolders).get();
          const folders = response.value as MailFolder[];

          if (includeChildren) {
            // Recursively fetch child folders for folders that have children
            await Promise.all(
              folders.map(async (folder) => {
                if (folder.childFolderCount && folder.childFolderCount > 0 && folder.id) {
                  folder.childFolders = await this.fetchChildFolders(client, folder.id);
                }
              })
            );
          }

          return folders;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-mail-folders'
    );
  }

  /**
   * Recursively fetch child folders
   *
   * @param client - Authenticated Graph client
   * @param parentFolderId - Parent folder ID
   * @returns Array of child mail folders
   */
  private async fetchChildFolders(client: Client, parentFolderId: string): Promise<MailFolder[]> {
    const response = await client.api(graphEndpoints.mailFolderChildFolders(parentFolderId)).get();
    const childFolders = response.value as MailFolder[];

    // Recursively fetch grandchildren
    await Promise.all(
      childFolders.map(async (folder) => {
        if (folder.childFolderCount && folder.childFolderCount > 0 && folder.id) {
          folder.childFolders = await this.fetchChildFolders(client, folder.id);
        }
      })
    );

    return childFolders;
  }

  /**
   * Get message by ID (delegated)
   *
   * Retrieves a specific email message by its ID.
   * Requires Mail.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @param messageId - Message ID
   * @returns Email message
   * @throws Error if Graph API call fails
   */
  async getMessageById(accessToken: string, messageId: string): Promise<Message> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const message = await client.api(graphEndpoints.messageById(messageId)).get();

          return message as Message;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-message-by-id'
    );
  }

  /**
   * Send email or create draft (delegated)
   *
   * Behavior controlled by EMAIL_SEND_MODE environment variable:
   * - 'draft' (default): Creates message in user's Drafts folder, returns draft ID
   * - 'send': Sends email immediately via sendMail API
   *
   * Requires Mail.Send or Mail.ReadWrite delegated permission.
   *
   * @param accessToken - User's access token
   * @param message - Message to send/draft
   * @returns Object with draftId when in draft mode, empty object when sent
   * @throws Error if Graph API call fails
   */
  async sendMail(
    accessToken: string,
    message: {
      subject: string;
      body: {
        contentType: 'Text' | 'HTML';
        content: string;
      };
      toRecipients: Array<{
        emailAddress: {
          address: string;
        };
      }>;
      ccRecipients?: Array<{
        emailAddress: {
          address: string;
        };
      }>;
      bccRecipients?: Array<{
        emailAddress: {
          address: string;
        };
      }>;
    }
  ): Promise<{ draftId?: string }> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          // OPS-280: Check email send mode
          if (graphConfig.emailSendMode === 'draft') {
            // Create draft in user's Drafts folder
            const response = await client.api(graphEndpoints.createDraft).post(message);
            return { draftId: response.id };
          } else {
            // Original behavior: send immediately
            await client.api(graphEndpoints.sendMail).post({
              message,
              saveToSentItems: true,
            });
            return {};
          }
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-send-mail'
    );
  }

  /**
   * Add attachment to a draft message
   *
   * Adds a file attachment to an existing draft message in the user's mailbox.
   * Used for attaching documents from the platform (SharePoint/OneDrive) to outgoing emails.
   *
   * Requires Mail.ReadWrite delegated permission.
   *
   * @param accessToken - User's access token
   * @param draftId - ID of the draft message to attach to
   * @param attachment - Attachment data
   * @returns The created attachment metadata
   * @throws Error if Graph API call fails
   */
  async addAttachmentToDraft(
    accessToken: string,
    draftId: string,
    attachment: {
      name: string;
      contentType: string;
      contentBase64: string;
    }
  ): Promise<{ id: string; name: string; size: number }> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          // MS Graph API expects @odata.type for file attachments
          const attachmentPayload = {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.name,
            contentType: attachment.contentType,
            contentBytes: attachment.contentBase64,
          };

          const response = await client
            .api(`/me/messages/${draftId}/attachments`)
            .post(attachmentPayload);

          return {
            id: response.id,
            name: response.name,
            size: response.size,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-add-attachment'
    );
  }

  /**
   * Send an existing draft message
   *
   * Sends a previously created draft message from the user's Drafts folder.
   * The message is moved to Sent Items after sending.
   *
   * Requires Mail.Send delegated permission.
   *
   * @param accessToken - User's access token
   * @param draftId - ID of the draft message to send
   * @throws Error if Graph API call fails
   */
  async sendDraft(accessToken: string, draftId: string): Promise<void> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);
          await client.api(`/me/messages/${draftId}/send`).post({});
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-send-draft'
    );
  }

  /**
   * Get user's OneDrive root (delegated)
   *
   * Retrieves the root folder of the user's OneDrive.
   * Requires Files.Read or Files.ReadWrite delegated permission.
   *
   * @param accessToken - User's access token
   * @returns Drive root metadata
   * @throws Error if Graph API call fails
   */
  async getDriveRoot(accessToken: string): Promise<DriveItem> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const driveRoot = await client.api(graphEndpoints.driveRoot).get();

          return driveRoot as DriveItem;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-drive-root'
    );
  }

  /**
   * Get drive item by ID (delegated)
   *
   * Retrieves metadata for a specific file or folder in OneDrive.
   * Requires Files.Read or Files.ReadWrite delegated permission.
   *
   * @param accessToken - User's access token
   * @param itemId - Drive item ID
   * @returns Drive item metadata
   * @throws Error if Graph API call fails
   */
  async getDriveItem(accessToken: string, itemId: string): Promise<DriveItem> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const driveItem = await client.api(graphEndpoints.driveItem(itemId)).get();

          return driveItem as DriveItem;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-drive-item'
    );
  }

  /**
   * List calendar events (delegated)
   *
   * Retrieves a list of events from the user's calendar.
   * Requires Calendars.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @param top - Number of events to retrieve (default: 10, max: 999)
   * @returns Array of calendar events
   * @throws Error if Graph API call fails
   */
  async listCalendarEvents(accessToken: string, top: number = 10): Promise<Event[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const response = await client
            .api(graphEndpoints.events)
            .top(top)
            .orderby('start/dateTime')
            .get();

          return response.value as Event[];
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-calendar-events'
    );
  }

  /**
   * Get calendar event by ID (delegated)
   *
   * Retrieves a specific calendar event by its ID.
   * Requires Calendars.Read delegated permission.
   *
   * @param accessToken - User's access token
   * @param eventId - Event ID
   * @returns Calendar event
   * @throws Error if Graph API call fails
   */
  async getCalendarEventById(accessToken: string, eventId: string): Promise<Event> {
    return retryWithBackoff(
      async () => {
        try {
          const client = this.getAuthenticatedClient(accessToken);

          const event = await client.api(graphEndpoints.eventById(eventId)).get();

          return event as Event;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-calendar-event'
    );
  }

  /**
   * Get organization users (delegated or app-only)
   *
   * Retrieves all users in the organization/tenant.
   * Requires User.ReadBasic.All or User.Read.All permission.
   *
   * @param accessToken - Access token (delegated) or undefined for app-only
   * @param filter - Optional OData filter (e.g., "accountEnabled eq true")
   * @returns Array of users in the organization
   * @throws Error if Graph API call fails
   */
  async getOrganizationUsers(accessToken?: string, filter?: string): Promise<User[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = accessToken
            ? this.getAuthenticatedClient(accessToken)
            : await this.getAppClient();

          let request = client
            .api(graphEndpoints.users)
            .select(
              'id,displayName,givenName,surname,mail,userPrincipalName,accountEnabled,jobTitle'
            )
            .top(999);

          if (filter) {
            request = request.filter(filter);
          }

          const response = await request.get();

          return response.value as User[];
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-organization-users'
    );
  }

  /**
   * Get user's group memberships (delegated or app-only)
   *
   * Retrieves all groups the user is a member of.
   * Requires GroupMember.Read.All or Directory.Read.All permission.
   *
   * @param userId - Azure AD user ID (use 'me' for current user)
   * @param accessToken - Access token (delegated) or undefined for app-only
   * @returns Array of groups the user belongs to
   * @throws Error if Graph API call fails
   */
  async getUserMemberOf(userId: string, accessToken?: string): Promise<Group[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = accessToken
            ? this.getAuthenticatedClient(accessToken)
            : await this.getAppClient();

          const endpoint =
            userId === 'me' ? graphEndpoints.meMemberOf : graphEndpoints.userMemberOf(userId);

          const response = await client.api(endpoint).select('id,displayName,description').get();

          // Filter to only return Group objects (not other directory objects)
          const groups = (response.value as DirectoryObject[]).filter(
            (obj) => obj['@odata.type'] === '#microsoft.graph.group'
          ) as Group[];

          return groups;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'graph-api-user-member-of'
    );
  }

  /**
   * Get current user's group memberships (delegated)
   *
   * Convenience method that retrieves groups for the authenticated user.
   *
   * @param accessToken - User's access token
   * @returns Array of groups the current user belongs to
   * @throws Error if Graph API call fails
   */
  async getMyGroups(accessToken: string): Promise<Group[]> {
    return this.getUserMemberOf('me', accessToken);
  }
}
