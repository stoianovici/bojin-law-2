/**
 * Login Page
 * Microsoft 365 Single Sign-On authentication
 * Story 2.4: Authentication with Azure AD
 */

'use client';

import React, { Suspense } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { PageLayout } from '../../components/linear/PageLayout';

// Session storage key for return URL
const RETURN_URL_KEY = 'auth_return_url';

function LoginPageContent() {
  const { isAuthenticated, login, error, clearError, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoginClicked, setIsLoginClicked] = React.useState(false);

  // Get the return URL from query params (set by ConditionalLayout when redirecting)
  const returnUrl = searchParams.get('returnUrl');

  // Redirect to intended destination if already authenticated
  useEffect(() => {
    console.log('[LoginPage] Auth state:', { isAuthenticated, isLoading, returnUrl });
    if (isAuthenticated) {
      // Check for stored returnUrl first (from before MSAL redirect)
      let destination = '/';
      const storedReturnUrl =
        typeof window !== 'undefined' ? sessionStorage.getItem(RETURN_URL_KEY) : null;

      if (storedReturnUrl) {
        // Clear stored URL after reading
        sessionStorage.removeItem(RETURN_URL_KEY);
        if (storedReturnUrl.startsWith('/') && !storedReturnUrl.startsWith('//')) {
          destination = storedReturnUrl;
        }
      } else if (returnUrl) {
        // Fall back to URL param
        try {
          const decoded = decodeURIComponent(returnUrl);
          if (decoded.startsWith('/') && !decoded.startsWith('//')) {
            destination = decoded;
          }
        } catch {
          // Invalid encoding, use default
        }
      }
      console.log('[LoginPage] User is authenticated, redirecting to', destination);
      // Use window.location for reliable redirect (router.push can fail in some cases)
      window.location.href = destination;
    }
  }, [isAuthenticated, isLoading, router, returnUrl]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Reset login clicked state when auth error occurs
  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoginClicked(false);
    }
  }, [error]);

  const handleLogin = async () => {
    // Prevent double-clicks
    if (isLoginClicked) {
      return;
    }
    setIsLoginClicked(true);

    // Store returnUrl before MSAL redirects away
    if (returnUrl && typeof window !== 'undefined') {
      try {
        const decoded = decodeURIComponent(returnUrl);
        if (decoded.startsWith('/') && !decoded.startsWith('//')) {
          sessionStorage.setItem(RETURN_URL_KEY, decoded);
          console.log('[LoginPage] Stored returnUrl for after login:', decoded);
        }
      } catch {
        // Invalid encoding, don't store
      }
    }

    try {
      await login();
    } catch {
      // Reset on error so user can try again
      setIsLoginClicked(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-linear-accent border-r-transparent"></div>
          <p className="mt-4 text-linear-text-secondary">Se încarcă...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-linear-text-primary">
            Legal Platform
          </h2>
          <p className="mt-2 text-center text-sm text-linear-text-secondary">
            Conectați-vă pentru a accesa spațiul de lucru
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
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
                <h3 className="text-sm font-medium text-red-400">{error}</h3>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    type="button"
                    onClick={clearError}
                    className="inline-flex rounded-md p-1.5 text-red-400 transition-colors hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-linear-bg-primary"
                  >
                    <span className="sr-only">Închide</span>
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoginClicked}
            className={`group relative flex w-full justify-center rounded-md border border-transparent px-4 py-3 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 focus:ring-offset-linear-bg-primary ${
              isLoginClicked ? 'cursor-not-allowed bg-linear-accent/60' : 'bg-linear-accent hover:bg-linear-accent-hover'
            }`}
          >
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              {isLoginClicked ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" />
              ) : (
                <svg
                  className="h-5 w-5 text-linear-accent-hover group-hover:text-linear-accent"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            {isLoginClicked ? 'Redirecționare...' : 'Conectare cu Microsoft 365'}
          </button>

          <p className="mt-2 text-center text-xs text-linear-text-tertiary">
            Această aplicație folosește Microsoft 365 pentru autentificare securizată.
            <br />
            Vă rugăm să folosiți email-ul organizației pentru a vă conecta.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-linear-text-tertiary">
          <p>Alimentat de Azure Active Directory</p>
        </div>
      </div>
    </PageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PageLayout className="flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-linear-accent border-r-transparent"></div>
            <p className="mt-4 text-linear-text-secondary">Se încarcă...</p>
          </div>
        </PageLayout>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
