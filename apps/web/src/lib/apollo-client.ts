/**
 * Apollo Client Configuration
 * Story 2.8: Case CRUD Operations UI
 *
 * Configured to work with GraphQL gateway with session-based authentication
 * Version: 2025-12-08-v12 (Pass MS access token for email sync)
 */

import { ApolloClient, InMemoryCache, HttpLink, from, ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { getMsalInstance, loginRequest } from './msal-config';

// Log version on client load to verify cache is updated
if (typeof window !== 'undefined') {
  console.log('[Apollo] Client version: 2025-12-08-v12');
}

/**
 * Get Microsoft access token for Graph API calls
 * This is needed for email sync operations
 */
async function getMsAccessToken(): Promise<string | null> {
  try {
    const msalInstance = getMsalInstance();
    if (!msalInstance) {
      return null;
    }

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      return null;
    }

    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });

    return response.accessToken;
  } catch (error) {
    console.warn('[Apollo] Failed to get MS access token:', error);
    return null;
  }
}

// GraphQL endpoint - use local proxy to avoid CORS/cookie issues in development
const GRAPHQL_URI = process.env.NEXT_PUBLIC_GRAPHQL_URI || '/api/graphql';

// Error handling link
// Note: UNAUTHENTICATED errors are handled by ConditionalLayout which checks auth state
// and redirects to /login if needed. We don't redirect here to avoid race conditions
// with auth initialization on page load.
const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach((gqlError: any) => {
      // Only log non-auth errors to avoid console spam during auth initialization
      if (gqlError.extensions?.code !== 'UNAUTHENTICATED') {
        console.error(
          `[GraphQL error]: Message: ${gqlError.message}, Location: ${gqlError.locations}, Path: ${gqlError.path}`,
          gqlError.extensions
        );
      }
    });
  }

  if (error.networkError) {
    console.error(`[Network error]: ${error.networkError}`);
  }
});

// HTTP link with credentials for session cookies
const httpLink = new HttpLink({
  uri: GRAPHQL_URI,
  credentials: 'include', // Send session cookie with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth link to include MS access token for operations that need it
// This allows the gateway to make Microsoft Graph API calls on behalf of the user
const authLink = setContext(async (operation, { headers }) => {
  // Only fetch token for operations that need Graph API access
  const operationsNeedingToken = [
    'StartEmailSync',
    'SyncEmailAttachments',
    'CreateEmailSubscription',
  ];

  const operationName = operation.operationName || '';
  if (operationsNeedingToken.includes(operationName)) {
    const token = await getMsAccessToken();
    if (token) {
      console.log('[Apollo] Including MS access token for:', operationName);
      return {
        headers: {
          ...headers,
          'x-ms-access-token': token,
        },
      };
    }
  }

  return { headers };
});

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          cases: {
            // Merge strategy for cases query
            keyArgs: ['status', 'clientId', 'assignedToMe'],
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
