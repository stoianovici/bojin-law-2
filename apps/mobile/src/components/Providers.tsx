'use client';

import { ApolloProvider } from '@apollo/client/react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { useEffect, useState } from 'react';
import { apolloClient, setMsAccessTokenGetter } from '@/lib/apollo';
import { msalConfig, graphScopes } from '@/lib/msal';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize MSAL
    msalInstance
      .initialize()
      .then(() => {
        // Set up the token getter for Apollo
        setMsAccessTokenGetter(async () => {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length === 0) return null;

          try {
            const response = await msalInstance.acquireTokenSilent({
              scopes: graphScopes,
              account: accounts[0],
            });
            return response.accessToken;
          } catch (error) {
            console.warn('[Providers] Failed to acquire token silently:', error);
            return null;
          }
        });

        setIsInitialized(true);
      })
      .catch((error) => {
        console.error('[Providers] MSAL initialization failed:', error);
        setIsInitialized(true); // Continue anyway
      });
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
    </MsalProvider>
  );
}
