/**
 * Apollo Client Configuration for Web V2
 * Connects to the GraphQL gateway with user context
 */

import { ApolloClient, InMemoryCache, HttpLink, from, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { useAuthStore } from '@/store/authStore';
import { getGatewayUrl } from '@/hooks/useGateway';

// Function to get MS access token - will be set by AuthProvider
let getMsAccessToken: (() => Promise<string | null>) | null = null;

/**
 * Set the function to retrieve MS access token from auth context
 */
export function setMsAccessTokenGetter(getter: () => Promise<string | null>) {
  getMsAccessToken = getter;
}

// GraphQL endpoint - use env var if set, otherwise dynamically determine from localStorage
const getGraphQLUri = () => process.env.NEXT_PUBLIC_API_URL || getGatewayUrl();

// Convert HTTP URL to WebSocket URL
const getWsUrl = (): string => {
  const httpUrl = getGraphQLUri();
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://');
  }
  // Default fallback for relative URLs
  return httpUrl;
};

// Helper to redirect to login with return URL
const redirectToLogin = () => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
    // Only redirect if not already on login page
    if (!window.location.pathname.startsWith('/login')) {
      console.log('[Apollo] Redirecting to login due to auth failure');
      window.location.href = loginUrl;
    }
  }
};

// Error handling link
const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach((gqlError: any) => {
      const errorCode = gqlError.extensions?.code;

      if (errorCode === 'UNAUTHENTICATED') {
        console.warn('[GraphQL] Authentication required - redirecting to login');
        redirectToLogin();
      } else if (errorCode === 'MS_TOKEN_REQUIRED') {
        console.warn('[GraphQL] MS token required - user needs to reconnect Microsoft account');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ms-token-required', { detail: { message: gqlError.message } })
          );
        }
      } else {
        console.error(`[GraphQL error]: ${gqlError.message}`, {
          locations: gqlError.locations,
          path: gqlError.path,
          extensions: gqlError.extensions,
        });
      }
    });
  }

  if (error.networkError) {
    const networkError = error.networkError as any;
    // Check for 401 Unauthorized responses
    if (networkError.statusCode === 401 || networkError.response?.status === 401) {
      console.warn('[Network] 401 Unauthorized - redirecting to login');
      redirectToLogin();
    } else {
      console.error(`[Network error]: ${error.networkError}`);
    }
  }
});

// HTTP link with credentials for session cookies
// URI is a function to allow dynamic gateway switching
const httpLink = new HttpLink({
  uri: getGraphQLUri,
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Role Structure:
 *
 * User-level roles (authentication/authorization):
 * - ADMIN: Partners with full access, can view financials
 * - LAWYER: Attorneys working on cases
 * - PARALEGAL: Support staff
 * - SECRETARY: Administrative staff
 *
 * Case-level roles (per-case assignment):
 * - Lead: Primary responsible for the case (exactly one per case)
 * - Support: Actively working on the case
 * - Observer: Read-only access to case
 *
 * Headers send user-level role for backend authorization.
 * Case-level roles are stored in the case.teamMembers array.
 */

// Map UI roles to gateway roles
const roleMapping: Record<string, string> = {
  ADMIN: 'Partner',
  LAWYER: 'Associate',
  PARALEGAL: 'Paralegal',
  SECRETARY: 'Paralegal',
};

// Auth link to add user context header for gateway authentication
const authLink = setContext(async (_, { headers }) => {
  // Get user from auth store
  const { user, _hasHydrated } = useAuthStore.getState();

  console.log('[Apollo authLink] Auth state:', {
    hasUser: !!user,
    userId: user?.id,
    email: user?.email,
    hasHydrated: _hasHydrated,
  });

  const newHeaders: Record<string, string> = { ...headers };

  // Add user context header if user is authenticated
  if (user) {
    const userContext = {
      userId: user.id,
      firmId: user.firmId,
      role: roleMapping[user.role] || 'Associate',
      email: user.email,
      hasOperationalOversight: user.hasOperationalOversight || false,
    };
    newHeaders['x-mock-user'] = JSON.stringify(userContext);
    console.log('[Apollo authLink] Added x-mock-user header for:', user.email);
  } else {
    console.warn('[Apollo authLink] No user in auth store!');
  }

  // Add MS access token if available
  if (getMsAccessToken) {
    try {
      const msAccessToken = await getMsAccessToken();
      if (msAccessToken) {
        newHeaders['x-ms-access-token'] = msAccessToken;
        console.log('[Apollo] Added x-ms-access-token header');
      } else {
        console.log('[Apollo] No MS access token available');
      }
    } catch (error) {
      console.warn('[Apollo] Failed to get MS access token:', error);
    }
  } else {
    console.log('[Apollo] getMsAccessToken not set yet');
  }

  return { headers: newHeaders };
});

// WebSocket link for subscriptions (client-side only)
// Note: setContext doesn't work with WebSocket, so we pass auth via connectionParams
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: getWsUrl,
          connectionParams: () => {
            const { user } = useAuthStore.getState();
            if (user) {
              const userContext = {
                userId: user.id,
                firmId: user.firmId,
                role: roleMapping[user.role] || 'Associate',
                email: user.email,
                hasOperationalOversight: user.hasOperationalOversight || false,
              };
              return {
                'x-mock-user': JSON.stringify(userContext),
              };
            }
            return {};
          },
        })
      )
    : null;

// Split link: subscriptions go to wsLink, queries/mutations go to httpLink
const splitLink =
  typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
          );
        },
        wsLink,
        from([errorLink, authLink, httpLink])
      )
    : from([errorLink, authLink, httpLink]);

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
