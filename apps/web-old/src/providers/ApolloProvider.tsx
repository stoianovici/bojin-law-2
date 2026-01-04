/**
 * Apollo Provider Component
 * Story 2.8: Case CRUD Operations UI
 *
 * Wraps the app with Apollo Client for GraphQL data fetching
 */

'use client';

import { ApolloProvider as ApolloClientProvider } from '@apollo/client/react';
import { apolloClient } from '../lib/apollo-client';

interface ApolloProviderProps {
  children: React.ReactNode;
}

export function ApolloProvider({ children }: ApolloProviderProps) {
  return <ApolloClientProvider client={apolloClient}>{children}</ApolloClientProvider>;
}
