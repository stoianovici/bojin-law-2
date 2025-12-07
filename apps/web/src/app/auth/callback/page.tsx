/**
 * OAuth Callback Page
 * Handles Azure AD OAuth redirect and token exchange
 * Story 2.4: Authentication with Azure AD
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Session storage key for return URL (must match login page)
const RETURN_URL_KEY = 'auth_return_url';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get error from query params (if OAuth failed)
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || 'Authentication failed. Please try again.');
          setIsProcessing(false);
          return;
        }

        // Check if user status from query params (backend sets this on pending/inactive users)
        const status = searchParams.get('status');
        const userEmail = searchParams.get('email');

        if (status === 'Pending') {
          setError(
            `Your account is pending activation. Please contact your firm's partner for access. (${userEmail})`
          );
          setIsProcessing(false);
          return;
        }

        if (status === 'Inactive') {
          setError(
            `Your account has been deactivated. Please contact your administrator for assistance. (${userEmail})`
          );
          setIsProcessing(false);
          return;
        }

        // Helper to get redirect destination
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

        // Directly verify session with backend (don't rely on AuthContext state which may be stale)
        console.log('[AuthCallback] Checking session with /api/auth/me...');
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await response.json();
        console.log('[AuthCallback] /api/auth/me response:', data);

        if (data.authenticated) {
          const destination = getRedirectDestination();
          console.log('[AuthCallback] Session verified, redirecting to:', destination);
          window.location.href = destination;
        } else {
          // Session not found - authentication failed
          console.log('[AuthCallback] Session not found, showing error');
          setError('Authentication failed. Please try again.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An error occurred during authentication. Please try again.');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams]);

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

  if (isProcessing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-900">Authenticating...</p>
          <p className="mt-2 text-sm text-gray-600">Please wait while we sign you in</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-lg font-medium text-gray-900">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
