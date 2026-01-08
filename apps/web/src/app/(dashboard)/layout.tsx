'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, Sidebar, Header, CommandPalette } from '@/components/layout';
import { TooltipProvider } from '@/components/ui';
import { apolloClient } from '@/lib/apollo-client';
import { START_EMAIL_SYNC } from '@/graphql/queries';

interface StartEmailSyncData {
  startEmailSync: {
    status: string;
    emailCount: number;
    lastSyncAt: string | null;
    pendingCategorization: number;
  };
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
        // Don't block user experience on sync failure
      });
  }, [isAuthenticated]);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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
