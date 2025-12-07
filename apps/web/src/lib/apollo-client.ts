/**
 * Apollo Client Configuration
 * Story 2.8: Case CRUD Operations UI
 *
 * Configured to work with GraphQL gateway with session-based authentication
 * Version: 2025-12-07-v2 (redirect fix deployed)
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// Log version on client load to verify cache is updated
if (typeof window !== 'undefined') {
  console.log('[Apollo] Client version: 2025-12-07-v2');
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

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
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
