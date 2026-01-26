'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TabBar, TabBarSpacer } from '@/components/layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Main content */}
      <main className="pb-safe-bottom">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Bottom spacer for TabBar */}
      <TabBarSpacer />

      {/* Bottom navigation */}
      <TabBar />
    </div>
  );
}
