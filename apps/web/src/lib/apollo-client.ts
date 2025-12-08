/**
 * Apollo Client Configuration
 * Story 2.8: Case CRUD Operations UI
 * Story 5.1: Email Integration (MS access token pass-through)
 *
 * Configured to work with GraphQL gateway with session-based authentication
 * Version: 2025-12-08-v13 (Fix: handle session-only auth without MSAL accounts)
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Log version on client load to verify cache is updated
if (typeof window !== 'undefined') {
  console.log('[Apollo] Client version: 2025-12-08-v13');
}

// Function to get MS access token - will be set by AuthProvider
let getMsAccessToken: (() => Promise<string | null>) | null = null;

/**
 * Set the function to retrieve MS access token from auth context
 * Called by AuthProvider during initialization
 */
export function setMsAccessTokenGetter(getter: () => Promise<string | null>) {
  getMsAccessToken = getter;
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

// Auth link to add MS access token for email operations
const authLink = setContext(async (_, { headers }) => {
  // Only fetch token if getter is available
  if (!getMsAccessToken) {
    return { headers };
  }

  try {
    const msAccessToken = await getMsAccessToken();
    if (msAccessToken) {
      return {
        headers: {
          ...headers,
          'x-ms-access-token': msAccessToken,
        },
      };
    }
  } catch (error) {
    console.warn('[Apollo] Failed to get MS access token:', error);
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
