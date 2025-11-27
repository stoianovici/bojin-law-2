/**
 * Conditional Layout Wrapper
 * Renders MainLayout only for authenticated routes
 * Public routes (login, etc.) render children directly
 */

'use client';

import React, { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MainLayout } from './MainLayout';
import { useAuth } from '../../lib/hooks/useAuth';

interface ConditionalLayoutProps {
  children: ReactNode;
}

// Routes that should NOT use MainLayout
const PUBLIC_ROUTES = ['/login', '/auth/callback'];

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  // Show loading state during auth initialization
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // For public routes, render children directly without MainLayout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For authenticated routes, check auth and render with MainLayout
  // In development mode, always show MainLayout for better UX
  // In production, require authentication
  const shouldShowLayout = process.env.NODE_ENV === 'development' || isAuthenticated;

  if (!shouldShowLayout) {
    // Not authenticated in production - render without layout
    // Individual pages should redirect to login
    return <>{children}</>;
  }

  // Authenticated user (or dev mode) on protected route - use MainLayout
  return <MainLayout>{children}</MainLayout>;
}
