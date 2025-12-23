/**
 * Apollo Client Configuration
 * Story 2.8: Case CRUD Operations UI
 * Story 5.1: Email Integration (MS access token pass-through)
 *
 * Configured to work with GraphQL gateway with session-based authentication
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Function to get MS access token - will be set by AuthProvider
let getMsAccessToken: (() => Promise<string | null>) | null = null;

// Promise that resolves when the token getter is available
let tokenGetterReadyResolve: (() => void) | null = null;
const tokenGetterReady = new Promise<void>((resolve) => {
  tokenGetterReadyResolve = resolve;
});

/**
 * Set the function to retrieve MS access token from auth context
 * Called by AuthProvider during initialization
 */
export function setMsAccessTokenGetter(getter: () => Promise<string | null>) {
  getMsAccessToken = getter;
  // Signal that getter is ready
  if (tokenGetterReadyResolve) {
    tokenGetterReadyResolve();
    tokenGetterReadyResolve = null;
  }
}

// GraphQL endpoint - use local proxy to avoid CORS/cookie issues in development
const GRAPHQL_URI = process.env.NEXT_PUBLIC_GRAPHQL_URI || '/api/graphql';

// Error handling link
// Note: UNAUTHENTICATED errors are handled by ConditionalLayout which checks auth state
// and redirects to /login if needed. We don't redirect here to avoid race conditions
// with auth initialization on page load.
// MS_TOKEN_REQUIRED errors indicate user is logged in but needs to reconnect Microsoft account
const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach((gqlError: any) => {
      const errorCode = gqlError.extensions?.code;

      // Only log non-auth errors to avoid console spam during auth initialization
      if (errorCode === 'MS_TOKEN_REQUIRED') {
        // User is authenticated but MS Graph token is missing
        // This happens when session cookie is valid but MSAL cache is empty
        console.warn('[GraphQL] MS token required - user needs to reconnect Microsoft account');
        // Dispatch custom event for UI components to show reconnect prompt
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ms-token-required', {
              detail: { message: gqlError.message },
            })
          );
        }
      } else if (errorCode !== 'UNAUTHENTICATED') {
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

// Maximum time to wait for token getter to be initialized (ms)
const TOKEN_GETTER_TIMEOUT = 3000;

/**
 * Wait for the token getter to be available with timeout
 */
async function waitForTokenGetter(): Promise<boolean> {
  if (getMsAccessToken) return true;

  // Race between getter ready and timeout
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), TOKEN_GETTER_TIMEOUT);
  });

  const readyPromise = tokenGetterReady.then(() => true);

  return Promise.race([readyPromise, timeoutPromise]);
}

// Auth link to add MS access token for email operations
const authLink = setContext(async (_operation, { headers }) => {
  // Wait for token getter to be available (handles race condition with AuthProvider init)
  const getterReady = await waitForTokenGetter();
  if (!getterReady || !getMsAccessToken) {
    // Token getter not available - proceed without MS token
    // This is fine for operations that don't require MS Graph access
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
    // Only log errors, not every operation
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
