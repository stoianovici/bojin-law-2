/**
 * Microsoft Graph API Configuration
 * Story 2.5: Microsoft Graph API Integration Foundation
 *
 * Configuration for Microsoft Graph client with authentication provider,
 * retry settings, and timeout configuration.
 *
 * Environment Variables Required:
 * - GRAPH_API_BASE_URL: Base URL for Graph API (default: https://graph.microsoft.com/v1.0)
 * - GRAPH_API_TIMEOUT: Request timeout in milliseconds (default: 30000)
 * - GRAPH_RETRY_MAX_ATTEMPTS: Maximum retry attempts (default: 5)
 * - GRAPH_RETRY_INITIAL_DELAY: Initial retry delay in milliseconds (default: 1000)
 * - GRAPH_RETRY_MAX_DELAY: Maximum retry delay in milliseconds (default: 32000)
 * - EMAIL_SEND_MODE: Email sending behavior - 'draft' saves to Drafts folder, 'send' sends immediately (default: 'draft')
 */

import { Client, ClientOptions } from '@microsoft/microsoft-graph-client';

/**
 * Email send mode type
 * - 'draft': Create message in user's Drafts folder (default, for review before send)
 * - 'send': Send email immediately via sendMail API
 */
export type EmailSendMode = 'draft' | 'send';

/**
 * Graph API configuration values
 */
export const graphConfig = {
  /**
   * Base URL for Microsoft Graph API
   * @default 'https://graph.microsoft.com/v1.0'
   */
  baseUrl: process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0',

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout: parseInt(process.env.GRAPH_API_TIMEOUT || '30000', 10),

  /**
   * Maximum retry attempts for transient failures
   * @default 5
   */
  retryMaxAttempts: parseInt(process.env.GRAPH_RETRY_MAX_ATTEMPTS || '5', 10),

  /**
   * Initial retry delay in milliseconds
   * @default 1000 (1 second)
   */
  retryInitialDelay: parseInt(process.env.GRAPH_RETRY_INITIAL_DELAY || '1000', 10),

  /**
   * Maximum retry delay in milliseconds
   * @default 32000 (32 seconds)
   */
  retryMaxDelay: parseInt(process.env.GRAPH_RETRY_MAX_DELAY || '32000', 10),

  /**
   * Email send mode - controls whether emails are sent immediately or saved as drafts
   * Set to 'draft' to save all outgoing emails to user's Drafts folder for review
   * Set to 'send' to send emails immediately (original behavior)
   * @default 'draft'
   */
  emailSendMode: (process.env.EMAIL_SEND_MODE || 'draft') as EmailSendMode,
};

/**
 * Microsoft Graph API scopes for application and delegated permissions
 */
export const graphScopes = {
  /**
   * Application-level permissions (app-only access)
   * Requires admin consent
   */
  application: [
    'Mail.Read',
    'Mail.Send',
    'Files.Read.All',
    'Files.ReadWrite.All',
    'Calendars.Read',
    'Calendars.ReadWrite',
  ],

  /**
   * Delegated permissions (user context)
   */
  delegated: {
    // User profile access
    userRead: ['User.Read'],

    // Email operations
    mail: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'],

    // OneDrive file operations
    files: ['Files.Read', 'Files.ReadWrite', 'Files.Read.All'],

    // SharePoint site operations (OPS-106)
    sites: ['Sites.Read.All', 'Sites.ReadWrite.All'],

    // Calendar operations
    calendar: ['Calendars.Read', 'Calendars.ReadWrite'],

    // Full delegated access (for development/testing)
    all: ['User.Read', 'Mail.ReadWrite', 'Files.ReadWrite', 'Calendars.ReadWrite'],
  },

  /**
   * Default scope for application-level access
   * Uses the .default scope which requests all statically configured permissions
   */
  default: ['https://graph.microsoft.com/.default'],
};

/**
 * Graph API endpoint paths
 */
export const graphEndpoints = {
  // User endpoints
  me: '/me',
  users: '/users',
  userById: (userId: string) => `/users/${userId}`,

  // Mail endpoints
  messages: '/me/messages',
  inboxMessages: '/me/mailFolders/Inbox/messages',
  sentMessages: '/me/mailFolders/SentItems/messages', // OPS-091: Sent emails sync
  messageById: (messageId: string) => `/me/messages/${messageId}`,
  sendMail: '/me/sendMail',
  createDraft: '/me/messages', // OPS-280: Create draft in Drafts folder (POST creates a draft)

  // OneDrive endpoints
  drive: '/me/drive',
  driveRoot: '/me/drive/root',
  driveItem: (itemId: string) => `/me/drive/items/${itemId}`,
  driveItemContent: (itemId: string) => `/me/drive/items/${itemId}/content`,
  driveItemVersions: (itemId: string) => `/me/drive/items/${itemId}/versions`,

  // OPS-104: Owner-aware OneDrive endpoints (for cross-user document access)
  // Uses /users/{userId}/drive/... instead of /me/drive/... to access another user's OneDrive
  driveItemByOwner: (ownerId: string, itemId: string) => `/users/${ownerId}/drive/items/${itemId}`,
  driveItemContentByOwner: (ownerId: string, itemId: string) =>
    `/users/${ownerId}/drive/items/${itemId}/content`,

  // Calendar endpoints
  calendar: '/me/calendar',
  events: '/me/calendar/events',
  eventById: (eventId: string) => `/me/calendar/events/${eventId}`,

  // Subscription endpoints (webhooks)
  subscriptions: '/subscriptions',
  subscriptionById: (subscriptionId: string) => `/subscriptions/${subscriptionId}`,

  // SharePoint endpoints (OPS-106)
  // Uses firm's SharePoint site instead of personal OneDrive for document storage
  sharepoint: {
    siteId: process.env.SHAREPOINT_SITE_ID || '',
    driveId: process.env.SHAREPOINT_DRIVE_ID || '',
    // Site and drive root endpoints
    site: () => `/sites/${process.env.SHAREPOINT_SITE_ID}`,
    drive: () => `/sites/${process.env.SHAREPOINT_SITE_ID}/drive`,
    driveRoot: () => `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root`,
    // Item operations
    driveItem: (itemId: string) => `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/items/${itemId}`,
    driveItemContent: (itemId: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/items/${itemId}/content`,
    driveItemPreview: (itemId: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/items/${itemId}/preview`,
    driveItemThumbnails: (itemId: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/items/${itemId}/thumbnails`,
    driveItemChildren: (itemId: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/items/${itemId}/children`,
    // Path-based operations
    driveItemByPath: (path: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root:/${path}`,
    driveItemContentByPath: (path: string) =>
      `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root:/${path}:/content`,
    // Folder children by path
    driveRootChildren: () => `/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root/children`,
  },
};

/**
 * Client options for Microsoft Graph SDK
 */
export const defaultClientOptions: ClientOptions = {
  defaultVersion: 'v1.0',
  debugLogging: process.env.NODE_ENV === 'development',
  authProvider: undefined, // Set by GraphService based on auth context
};

/**
 * Create a Graph client with the given access token
 * This is a helper for user-delegated scenarios
 *
 * @param accessToken - OAuth access token with Graph API permissions
 * @returns Configured Microsoft Graph client instance
 */
export const createGraphClient = (accessToken: string): Client => {
  return Client.init({
    ...defaultClientOptions,
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
};

/**
 * Validate Graph API configuration
 * Checks that configuration values are within acceptable ranges
 *
 * @returns Validation result with status and error messages
 */
export const validateGraphConfig = (): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate base URL format
  try {
    const url = new URL(graphConfig.baseUrl);
    if (url.protocol !== 'https:') {
      errors.push('GRAPH_API_BASE_URL must use HTTPS protocol');
    }
    if (!url.hostname.includes('graph.microsoft.com')) {
      warnings.push(
        'GRAPH_API_BASE_URL does not point to graph.microsoft.com - ensure this is intentional'
      );
    }
  } catch (error) {
    errors.push('GRAPH_API_BASE_URL must be a valid URL');
  }

  // Validate timeout
  if (graphConfig.timeout < 1000) {
    errors.push('GRAPH_API_TIMEOUT must be at least 1000ms (1 second)');
  }
  if (graphConfig.timeout > 120000) {
    warnings.push('GRAPH_API_TIMEOUT exceeds 120 seconds - may cause long request delays');
  }

  // Validate retry configuration
  if (graphConfig.retryMaxAttempts < 0) {
    errors.push('GRAPH_RETRY_MAX_ATTEMPTS must be a non-negative integer');
  }
  if (graphConfig.retryMaxAttempts > 10) {
    warnings.push('GRAPH_RETRY_MAX_ATTEMPTS exceeds 10 - may cause excessive delays on failures');
  }

  if (graphConfig.retryInitialDelay < 100) {
    errors.push('GRAPH_RETRY_INITIAL_DELAY must be at least 100ms');
  }

  if (graphConfig.retryMaxDelay < graphConfig.retryInitialDelay) {
    errors.push('GRAPH_RETRY_MAX_DELAY must be greater than or equal to GRAPH_RETRY_INITIAL_DELAY');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

// Run validation on module load (except in test environment)
const isJest = typeof jest !== 'undefined' || process.env.JEST_WORKER_ID !== undefined;
const shouldRunValidation =
  !isJest && process.env.NODE_ENV !== 'test' && !process.env.SKIP_GRAPH_VALIDATION;

if (shouldRunValidation) {
  const validation = validateGraphConfig();

  if (!validation.valid) {
    console.error('❌ Microsoft Graph API configuration validation failed:', validation.errors);
    throw new Error(`Invalid Graph API configuration: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Microsoft Graph API configuration warnings:', validation.warnings);
  }

  console.log('✅ Microsoft Graph API configuration validated successfully');
}
