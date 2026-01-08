'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, Sidebar, Header, CommandPalette } from '@/components/layout';
import { TooltipProvider } from '@/components/ui';
import { toast } from '@/components/ui/toast';
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

// Handle MS token required events - automatically trigger Microsoft login
function useMsTokenHandler() {
  const { instance, accounts } = useMsal();
  const handledRef = useRef(false);

  const handleMsTokenRequired = useCallback(async () => {
    // Prevent multiple login attempts
    if (handledRef.current) return;
    handledRef.current = true;

    console.log('[MsTokenHandler] MS token required - triggering Microsoft login');

    // Show toast to inform user
    toast({
      title: 'Conectare Microsoft',
      description: 'Se deschide fereastra de autentificare Microsoft...',
      variant: 'default',
      duration: 5000,
    });

    try {
      // If user already has an MSAL account, try silent first
      const account = accounts[0];
      let tokenResponse;

      if (account) {
        try {
          tokenResponse = await instance.acquireTokenSilent({
            scopes: mailScopes,
            account,
          });
          console.log('[MsTokenHandler] Got token silently');
        } catch {
          // Silent failed, try popup
          tokenResponse = await instance.acquireTokenPopup({
            scopes: mailScopes,
          });
          console.log('[MsTokenHandler] Got token via popup');
        }
      } else {
        // No account, need interactive login
        tokenResponse = await instance.acquireTokenPopup({
          scopes: mailScopes,
        });
        console.log('[MsTokenHandler] Got token via popup (new login)');
      }

      if (tokenResponse?.accessToken) {
        console.log('[MsTokenHandler] MSAL login successful, retrying sync');

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
            console.error('[MsTokenHandler] Sync failed after login:', err);
            toast({
              title: 'Eroare sincronizare',
              description: 'Sincronizarea a eșuat. Încearcă din nou mai târziu.',
              variant: 'error',
            });
          });
      }
    } catch (error: any) {
      console.error('[MsTokenHandler] MSAL login failed:', error);

      // User cancelled or other error
      const isCancelled =
        error?.errorCode === 'user_cancelled' || error?.message?.includes('cancelled');

      toast({
        title: isCancelled ? 'Autentificare anulată' : 'Eroare conectare',
        description: isCancelled
          ? 'Autentificarea Microsoft a fost anulată.'
          : 'Nu s-a putut conecta contul Microsoft. Încearcă din nou.',
        variant: isCancelled ? 'warning' : 'error',
      });
    } finally {
      // Reset handled flag after delay to allow retry
      setTimeout(() => {
        handledRef.current = false;
      }, 3000);
    }
  }, [instance, accounts]);

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
    </TooltipProvider>
  );
}
