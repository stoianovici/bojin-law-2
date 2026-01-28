/**
 * Apollo Client Configuration for Mobile
 * Connects to the GraphQL gateway with user context
 * Supports WebSocket subscriptions for real-time features
 */

import { ApolloClient, InMemoryCache, HttpLink, from, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { useAuthStore } from '@/store/auth';

// Function to get MS access token - will be set by AuthProvider
let getMsAccessToken: (() => Promise<string | null>) | null = null;

export function setMsAccessTokenGetter(getter: () => Promise<string | null>) {
  getMsAccessToken = getter;
}

// GraphQL endpoint - production API
const getGraphQLUri = () => {
  if (typeof window === 'undefined') {
    return process.env.GATEWAY_URL || 'http://localhost:4000/graphql';
  }
  // In production, use the API domain
  if (window.location.hostname === 'm.bojin-law.com') {
    return 'https://api.bojin-law.com/graphql';
  }
  // In development, use the rewrites proxy
  return '/api/graphql';
};

// Convert HTTP URL to WebSocket URL for subscriptions
const getWsUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:4000/graphql';
  }
  // In production, use WebSocket API domain
  if (window.location.hostname === 'm.bojin-law.com') {
    return 'wss://api.bojin-law.com/graphql';
  }
  // In development, connect directly to gateway (rewrites don't work for WS)
  return 'ws://localhost:4000/graphql';
};

// Error handling link
const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach((gqlError: any) => {
      const errorCode = gqlError.extensions?.code;

      if (errorCode === 'UNAUTHENTICATED') {
        console.warn('[GraphQL] Authentication required');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      } else {
        console.error(`[GraphQL error]: ${gqlError.message}`);
      }
    });
  }

  if (error.networkError) {
    const networkError = error.networkError as any;
    const status = networkError.statusCode || networkError.response?.status;
    if (status === 401) {
      console.warn('[Network] 401 Unauthorized');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else {
      console.error(`[Network error]: ${error.networkError}`);
    }
  }
});

// HTTP link
const httpLink = new HttpLink({
  uri: getGraphQLUri,
  credentials: 'include',
});

// Role mapping (user-level to gateway)
const roleMapping: Record<string, string> = {
  ADMIN: 'Partner',
  LAWYER: 'Associate',
  PARALEGAL: 'Paralegal',
  SECRETARY: 'Paralegal',
};

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
              };
              return {
                'x-mock-user': JSON.stringify(userContext),
              };
            }
            return {};
          },
          // Reconnect on connection loss
          retryAttempts: Infinity,
          shouldRetry: () => true,
        })
      )
    : null;

// Auth link to add user context
const authLink = setContext(async (_, { headers }) => {
  const { user } = useAuthStore.getState();
  const newHeaders: Record<string, string> = { ...headers };

  // Only add x-mock-user header if user has complete profile (with email)
  // This ensures server falls back to MS token decoding during initial auth
  if (user && user.email) {
    const userContext = {
      userId: user.id,
      firmId: user.firmId,
      role: roleMapping[user.role] || 'Associate',
      email: user.email,
    };
    newHeaders['x-mock-user'] = JSON.stringify(userContext);
  }

  // Add MS access token if available
  if (getMsAccessToken) {
    try {
      const msAccessToken = await getMsAccessToken();
      if (msAccessToken) {
        newHeaders['x-ms-access-token'] = msAccessToken;
      }
    } catch (error) {
      console.warn('[Apollo] Failed to get MS access token:', error);
    }
  }

  return { headers: newHeaders };
});

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
