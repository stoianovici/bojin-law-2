/**
 * Conditional Layout Wrapper
 * Renders MainLayout only for authenticated routes
 * Public routes (login, etc.) render children directly
 * Redirects unauthenticated users to login in production
 */

'use client';

import React, { type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MainLayout } from './MainLayout';
import { useAuth } from '../../lib/hooks/useAuth';

interface ConditionalLayoutProps {
  children: ReactNode;
}

// Routes that should NOT use MainLayout
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/403'];

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));

  // Redirect unauthenticated users to login in production
  useEffect(() => {
    // Debug logging for redirect tracing
    if (typeof window !== 'undefined' && !isPublicRoute) {
      console.log('[ConditionalLayout] Auth state:', {
        isLoading,
        isAuthenticated,
        isPublicRoute,
        pathname,
        nodeEnv: process.env.NODE_ENV,
      });
    }

    if (!isLoading && !isAuthenticated && !isPublicRoute && process.env.NODE_ENV === 'production') {
      console.log('[ConditionalLayout] Redirecting to /login - user not authenticated');
      // Preserve the intended destination so login can redirect back
      const returnUrl = encodeURIComponent(pathname || '/');
      router.replace(`/login?returnUrl=${returnUrl}`);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname]);

  // Show loading state during auth initialization
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Se încarcă...</p>
        </div>
      </div>
    );
  }

  // For public routes, render children directly without MainLayout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // In production, require authentication - show loading while redirecting
  if (!isAuthenticated && process.env.NODE_ENV === 'production') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Redirecționare către autentificare...</p>
        </div>
      </div>
    );
  }

  // Authenticated user (or dev mode) on protected route - use MainLayout
  return <MainLayout>{children}</MainLayout>;
}
