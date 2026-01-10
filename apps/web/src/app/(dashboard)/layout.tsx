'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, Sidebar, Header, CommandPalette } from '@/components/layout';
import { TooltipProvider } from '@/components/ui';
import { toast, Toaster } from '@/components/ui/toast';
import { apolloClient } from '@/lib/apollo-client';
import { START_EMAIL_SYNC } from '@/graphql/queries';
import { mailScopes } from '@/lib/msal-config';

interface StartEmailSyncData {
  startEmailSync: {
    status: string;
    emailCount: number;
    lastSyncAt: string | null;
    pendingCategorization: number;
  };
}

// Handle MS token required events - try silent token acquisition only
// Interactive flows (popup/redirect) are disabled to prevent conflicts with login page
function useMsTokenHandler() {
  const { instance, accounts, inProgress } = useMsal();
  const handledRef = useRef(false);

  const handleMsTokenRequired = useCallback(async () => {
    // Prevent multiple attempts and don't interfere with other interactions
    if (handledRef.current || inProgress !== 'none') {
      console.log('[MsTokenHandler] Skipping - already handling or interaction in progress');
      return;
    }
    handledRef.current = true;

    console.log('[MsTokenHandler] MS token required - trying silent acquisition');

    try {
      // Only try silent acquisition - no interactive flows
      // Interactive flows would conflict with login redirects
      const account = accounts[0];
      if (!account) {
        console.log('[MsTokenHandler] No account, user needs to login via login page');
        toast({
          title: 'Autentificare necesară',
          description: 'Vă rugăm să vă autentificați cu Microsoft pentru a sincroniza email-urile.',
          variant: 'warning',
        });
        return;
      }

      const tokenResponse = await instance.acquireTokenSilent({
        scopes: mailScopes,
        account,
      });

      if (tokenResponse?.accessToken) {
        console.log('[MsTokenHandler] Got token silently, retrying sync');

        // Clear the session flag to retry sync
        sessionStorage.removeItem('email-sync-triggered');

        // Small delay to ensure token is available in next request
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Trigger sync again
        apolloClient
          .mutate<StartEmailSyncData>({ mutation: START_EMAIL_SYNC })
          .then(() => {
            toast({
              title: 'Sincronizare pornită',
              description: 'Email-urile se sincronizează în fundal.',
              variant: 'success',
            });
          })
          .catch((err) => {
            console.error('[MsTokenHandler] Sync failed after token refresh:', err);
          });
      }
    } catch (error) {
      // Silent acquisition failed - don't start interactive flow
      // User will need to re-authenticate via login page
      console.warn('[MsTokenHandler] Silent token acquisition failed:', (error as Error)?.message);
      toast({
        title: 'Sesiune expirată',
        description: 'Vă rugăm să vă re-autentificați pentru a sincroniza email-urile.',
        variant: 'warning',
      });
    } finally {
      // Reset handled flag after delay to allow retry
      setTimeout(() => {
        handledRef.current = false;
      }, 3000);
    }
  }, [instance, accounts, inProgress]);

  useEffect(() => {
    const handler = () => handleMsTokenRequired();
    window.addEventListener('ms-token-required', handler);
    return () => window.removeEventListener('ms-token-required', handler);
  }, [handleMsTokenRequired]);
}

// Auto-sync emails on login (runs once per session)
function useAutoEmailSync(isAuthenticated: boolean) {
  const syncTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || syncTriggeredRef.current) return;

    // Check if we've already synced this session
    const sessionKey = 'email-sync-triggered';
    if (sessionStorage.getItem(sessionKey)) {
      syncTriggeredRef.current = true;
      return;
    }

    // Trigger sync in background
    console.log('[AutoSync] Triggering email sync on login...');
    syncTriggeredRef.current = true;
    sessionStorage.setItem(sessionKey, 'true');

    apolloClient
      .mutate<StartEmailSyncData>({ mutation: START_EMAIL_SYNC })
      .then((result) => {
        console.log('[AutoSync] Email sync started:', result.data?.startEmailSync?.status);
      })
      .catch((error) => {
        console.warn('[AutoSync] Email sync failed:', error.message);
        // The MS_TOKEN_REQUIRED error will trigger the ms-token-required event
        // which is handled by useMsTokenHandler
      });
  }, [isAuthenticated]);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Handle MS token required events (prompts user to connect Microsoft)
  useMsTokenHandler();

  // Auto-sync emails when user logs in
  useAutoEmailSync(isAuthenticated);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent(window.location.pathname));
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-bg-primary">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <TooltipProvider>
      <AppShell sidebar={<Sidebar />} header={<Header />}>
        {children}
      </AppShell>
      <CommandPalette />
      <Toaster />
    </TooltipProvider>
  );
}
