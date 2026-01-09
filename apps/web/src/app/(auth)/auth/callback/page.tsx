'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auth callback page - handles redirect after Microsoft login
 *
 * Note: handleRedirectPromise() is called once in AuthProvider during initialization.
 * This page just waits for MSAL to process the redirect and then navigates to the return URL.
 * We don't call handleRedirectPromise() here to avoid duplicate calls which cause
 * "interaction_in_progress" errors.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Give MSAL time to process the redirect (handled by AuthProvider)
    // Then redirect to the intended destination
    const timer = setTimeout(() => {
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      sessionStorage.removeItem('returnUrl');
      router.push(returnUrl);
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-linear-text-secondary">Se procesează autentificarea...</p>
      </div>
    </div>
  );
}
