'use client';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'Partner' | 'Admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check role requirement
  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredRole) {
      if (user?.role !== requiredRole && user?.role !== 'Admin') {
        router.push('/?error=insufficient_permissions');
      }
    }
  }, [isAuthenticated, isLoading, requiredRole, user?.role, router]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'Admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-sm border border-amber-200 p-8 max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">
            This feature requires {requiredRole} access. Your current role is {user?.role}.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
