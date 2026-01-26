'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { useAuthStore } from '@/store/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { instance, accounts } = useMsal();
  const { setUser, setLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the redirect response
        const response = await instance.handleRedirectPromise();

        if (response) {
          // Successfully authenticated
          const account = response.account;

          if (account) {
            // Map MSAL account to our User type
            const user = {
              id: account.localAccountId,
              email: account.username,
              name: account.name || account.username,
              role: 'LAWYER' as const, // Default role, should be fetched from backend
              firmId: 'default-firm', // Should be fetched from backend
              avatarUrl: undefined,
            };

            setUser(user);

            // Redirect to home
            router.replace('/');
            return;
          }
        }

        // If no response, check if already signed in
        if (accounts.length > 0) {
          const account = accounts[0];
          const user = {
            id: account.localAccountId,
            email: account.username,
            name: account.name || account.username,
            role: 'LAWYER' as const,
            firmId: 'default-firm',
            avatarUrl: undefined,
          };

          setUser(user);
          router.replace('/');
          return;
        }

        // No account found, redirect to login
        setLoading(false);
        router.replace('/login');
      } catch (err) {
        console.error('[Auth Callback] Error:', err);
        setError('Autentificare eșuată. Te rugăm să încerci din nou.');
        setLoading(false);
      }
    };

    handleCallback();
  }, [instance, accounts, setUser, setLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-error">Eroare</h1>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <button onClick={() => router.replace('/login')} className="mt-4 text-accent underline">
            Înapoi la autentificare
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-text-secondary">Se procesează autentificarea...</p>
      </div>
    </div>
  );
}
