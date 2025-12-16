/**
 * Conditional Layout Wrapper
 * Renders MainLayout only for authenticated routes
 * Public routes (login, etc.) render children directly
 * Redirects unauthenticated users to login in production
 */

'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
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
  // Track if we've verified the session independently (to avoid race conditions with AuthContext)
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));

  // Redirect unauthenticated users to login
  // Set NEXT_PUBLIC_SKIP_AUTH=true to bypass in development
  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  useEffect(() => {
    // Skip all checks for public routes, authenticated users, or still loading
    if (isPublicRoute || isAuthenticated || isLoading || skipAuth) return;

    // AuthContext says not authenticated and not loading
    // Double-check session cookie before redirecting to avoid race conditions
    if (sessionVerified === null) {
      const checkBeforeRedirect = async () => {
        try {
          console.log('[ConditionalLayout] Checking /api/auth/me before redirect...');
          const response = await fetch('/api/auth/me', { credentials: 'include' });
          const data = await response.json();
          console.log('[ConditionalLayout] /api/auth/me response:', data);
          if (data.authenticated) {
            console.log('[ConditionalLayout] Session cookie valid, marking as verified');
            setSessionVerified(true);
            return;
          }
        } catch (error) {
          console.error('[ConditionalLayout] Session check error:', error);
        }

        console.log('[ConditionalLayout] No valid session, redirecting to /login');
        setSessionVerified(false);
        const returnUrl = encodeURIComponent(pathname || '/');
        router.replace(`/login?returnUrl=${returnUrl}`);
      };

      checkBeforeRedirect();
    } else if (sessionVerified === false) {
      // Already verified as not authenticated, redirect
      const returnUrl = encodeURIComponent(pathname || '/');
      router.replace(`/login?returnUrl=${returnUrl}`);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname, sessionVerified, skipAuth]);

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

  // Require authentication (unless NEXT_PUBLIC_SKIP_AUTH=true)
  // But also allow if we've independently verified the session
  if (!isAuthenticated && !sessionVerified && !skipAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Se verifică sesiunea...</p>
        </div>
      </div>
    );
  }

  // Authenticated user (or skipAuth mode) on protected route - use MainLayout
  return <MainLayout>{children}</MainLayout>;
}
