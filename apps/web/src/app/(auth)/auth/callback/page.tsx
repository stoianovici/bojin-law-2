'use client';

import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const { instance } = useMsal();
  const router = useRouter();

  useEffect(() => {
    instance
      .handleRedirectPromise()
      .then((response) => {
        if (response) {
          // Token acquired, redirect to intended destination
          const returnUrl = sessionStorage.getItem('returnUrl') || '/';
          sessionStorage.removeItem('returnUrl');
          router.push(returnUrl);
        } else {
          router.push('/');
        }
      })
      .catch((error) => {
        console.error('Auth callback error:', error);
        router.push('/login?error=callback_failed');
      });
  }, [instance, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-linear-text-secondary">Se procesează autentificarea...</p>
      </div>
    </div>
  );
}
