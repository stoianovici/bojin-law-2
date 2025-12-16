/**
 * Azure AD Authentication Configuration
 * Story 2.4: Authentication with Azure AD
 *
 * MSAL Node configuration for OAuth 2.0 authentication flow.
 *
 * Environment Variables Required:
 * - AZURE_AD_CLIENT_ID: Application (client) ID from Azure AD app registration
 * - AZURE_AD_CLIENT_SECRET: Client secret from Azure AD app registration
 * - AZURE_AD_TENANT_ID: Directory (tenant) ID from Azure AD
 * - AZURE_AD_REDIRECT_URI: OAuth redirect URI (must match app registration)
 * - NODE_ENV: Environment (development, staging, production)
 */

import { Configuration, LogLevel } from '@azure/msal-node';

// Validate required environment variables
const requiredEnvVars = [
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_TENANT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'AZURE_AD_REDIRECT_URI',
] as const;

// Check for missing environment variables
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required Azure AD environment variables: ${missingVars.join(', ')}. ` +
      'Please configure these in your .env file.'
  );
}

// Azure AD configuration values from environment
export const azureAdConfig = {
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  tenantId: process.env.AZURE_AD_TENANT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  redirectUri: process.env.AZURE_AD_REDIRECT_URI!,
  authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
};

// MSAL Node configuration
// Ref: https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html
export const msalConfig: Configuration = {
  auth: {
    clientId: azureAdConfig.clientId,
    authority: azureAdConfig.authority,
    clientSecret: azureAdConfig.clientSecret,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (containsPii) {
          return; // Don't log PII
        }

        switch (loglevel) {
          case LogLevel.Error:
            console.error('[MSAL Error]', message);
            return;
          case LogLevel.Warning:
            console.warn('[MSAL Warning]', message);
            return;
          case LogLevel.Info:
            if (process.env.NODE_ENV === 'development') {
              console.info('[MSAL Info]', message);
            }
            return;
          case LogLevel.Verbose:
            if (process.env.NODE_ENV === 'development') {
              console.debug('[MSAL Verbose]', message);
            }
            return;
          case LogLevel.Trace:
            if (process.env.NODE_ENV === 'development') {
              console.trace('[MSAL Trace]', message);
            }
            return;
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'production' ? LogLevel.Warning : LogLevel.Info,
    },
  },
};

// OAuth 2.0 scopes for Microsoft Graph API
// Ref: https://docs.microsoft.com/en-us/graph/permissions-reference
export const authScopes = {
  // OpenID Connect scopes (required for authentication)
  openid: ['openid', 'profile', 'email', 'offline_access'],

  // Microsoft Graph API scopes
  graph: {
    // Read user profile (delegated permission)
    userRead: ['User.Read'],

    // Read basic info of all users (optional, requires admin consent)
    userReadBasicAll: ['User.ReadBasic.All'],
  },
};

// Default scopes for authorization request
// Includes OpenID Connect scopes + User.Read for profile access
export const defaultScopes = [...authScopes.openid, ...authScopes.graph.userRead];

// Token configuration
export const tokenConfig = {
  // Access token expiry: 30 minutes (in milliseconds)
  accessTokenExpiry: 30 * 60 * 1000,

  // Refresh token expiry: 7 days (in milliseconds)
  refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000,
};

// Validate configuration
export const validateAuthConfig = (): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Check client ID format (GUID)
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!guidRegex.test(azureAdConfig.clientId)) {
    errors.push('AZURE_AD_CLIENT_ID must be a valid GUID');
  }

  if (!guidRegex.test(azureAdConfig.tenantId)) {
    errors.push('AZURE_AD_TENANT_ID must be a valid GUID');
  }

  // Check client secret length (minimum 16 characters)
  if (azureAdConfig.clientSecret.length < 16) {
    errors.push('AZURE_AD_CLIENT_SECRET must be at least 16 characters');
  }

  // Check redirect URI format
  try {
    const url = new URL(azureAdConfig.redirectUri);

    // In production, redirect URI must be HTTPS
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      errors.push('AZURE_AD_REDIRECT_URI must use HTTPS in production environment');
    }

    // Check if redirect URI ends with /auth/callback
    if (!url.pathname.endsWith('/auth/callback')) {
      errors.push(
        'AZURE_AD_REDIRECT_URI must end with /auth/callback (e.g., https://example.com/auth/callback)'
      );
    }
  } catch (error) {
    errors.push('AZURE_AD_REDIRECT_URI must be a valid URL');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Run validation on module load (except in test environment)
// In test, validation is called explicitly by tests
// Skip validation if running under Jest or if explicitly disabled
const isJest = typeof jest !== 'undefined' || process.env.JEST_WORKER_ID !== undefined;
const shouldRunValidation =
  !isJest && process.env.NODE_ENV !== 'test' && !process.env.SKIP_AUTH_VALIDATION;

if (shouldRunValidation) {
  const validation = validateAuthConfig();
  if (!validation.valid) {
    console.error('❌ Azure AD configuration validation failed:', validation.errors);
    throw new Error(`Invalid Azure AD configuration: ${validation.errors.join(', ')}`);
  } else {
    console.log('✅ Azure AD configuration validated successfully');
  }
}
