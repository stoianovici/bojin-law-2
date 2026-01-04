/**
 * OAuth Callback Page
 * Handles Azure AD OAuth redirect and token exchange
 * Story 2.4: Authentication with Azure AD
 *
 * FIX (v9): This page now waits for AuthContext to finish processing
 * the MSAL redirect instead of racing with a direct /api/auth/me check.
 * AuthContext's handleRedirectPromise() sets the session cookie via provisionUser(),
 * and only then sets isAuthenticated: true.
 */

'use client';

import React, { useEffect, useState, Suspense, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

// Session storage key for return URL (must match login page)
const RETURN_URL_KEY = 'auth_return_url';

// Timeout for auth processing (10 seconds)
const AUTH_TIMEOUT_MS = 10000;

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, error: authError } = useAuth();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const hasRedirected = useRef(false);

  // Compute error from various sources (no setState in effects)
  const error = useMemo(() => {
    // OAuth error from URL params
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (errorParam) {
      console.log('[AuthCallback] OAuth error from URL:', errorParam, errorDescription);
      return errorDescription || 'Authentication failed. Please try again.';
    }

    // User status errors (pending/inactive)
    const status = searchParams.get('status');
    const userEmail = searchParams.get('email');
    if (status === 'Pending') {
      return `Your account is pending activation. Please contact your firm's partner for access. (${userEmail})`;
    }
    if (status === 'Inactive') {
      return `Your account has been deactivated. Please contact your administrator for assistance. (${userEmail})`;
    }

    // AuthContext error
    if (authError) {
      console.log('[AuthCallback] AuthContext error:', authError);
      return authError;
    }

    // Timeout error
    if (hasTimedOut && !isLoading && !isAuthenticated) {
      console.log('[AuthCallback] Auth failed after timeout');
      return 'Authentication timed out. Please try again.';
    }

    return null;
  }, [searchParams, authError, hasTimedOut, isLoading, isAuthenticated]);

  // Get redirect destination from sessionStorage (saved before MSAL redirect)
  const getRedirectDestination = (): string => {
    if (typeof window !== 'undefined') {
      const storedReturnUrl = sessionStorage.getItem(RETURN_URL_KEY);
      if (storedReturnUrl) {
        sessionStorage.removeItem(RETURN_URL_KEY);
        if (storedReturnUrl.startsWith('/') && !storedReturnUrl.startsWith('//')) {
          console.log('[AuthCallback] Using stored returnUrl:', storedReturnUrl);
          return storedReturnUrl;
        }
      }
    }
    return '/';
  };

  // Set up timeout for auth processing
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('[AuthCallback] Auth timeout reached');
      setHasTimedOut(true);
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, []);

  // Wait for AuthContext to finish processing, then redirect
  useEffect(() => {
    console.log('[AuthCallback] Auth state:', { isLoading, isAuthenticated, hasTimedOut, error });

    // Don't redirect if there's an error or we've already redirected
    if (error || hasRedirected.current) {
      return;
    }

    // AuthContext is still processing - wait
    if (isLoading) {
      console.log('[AuthCallback] Waiting for AuthContext to finish processing...');
      return;
    }

    // AuthContext finished - check if authenticated
    if (isAuthenticated) {
      hasRedirected.current = true;
      const destination = getRedirectDestination();
      console.log('[AuthCallback] Auth successful, redirecting to:', destination);
      // Use window.location.href for a full page load to ensure clean state
      window.location.href = destination;
      return;
    }

    // AuthContext finished but not authenticated - wait for timeout
    console.log(
      '[AuthCallback] AuthContext finished but not authenticated, waiting for timeout...'
    );
  }, [isLoading, isAuthenticated, hasTimedOut, error]);

  // Show error UI
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Authentication Error
            </h2>
          </div>

          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading UI while AuthContext processes the redirect
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-4 text-lg font-medium text-gray-900">Se autentifică...</p>
        <p className="mt-2 text-sm text-gray-600">Vă rugăm să așteptați în timp ce vă conectăm</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-lg font-medium text-gray-900">Se încarcă...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
