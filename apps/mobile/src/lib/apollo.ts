/**
 * Apollo Client Configuration for Mobile
 * Connects to the GraphQL gateway with user context
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
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

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
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
