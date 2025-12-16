'use client';

/**
 * Auth Callback Page
 * Handles redirect from Azure AD after authentication
 * MSAL will process the response and AuthProvider will handle the rest
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // After MSAL processes the redirect response in AuthProvider,
    // redirect to the main page or login based on auth state
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/');
      } else if (error) {
        router.push(`/login?error=${encodeURIComponent(error)}`);
      }
      // If neither authenticated nor error, MSAL is still processing
    }
  }, [isAuthenticated, isLoading, error, router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Se finalizează autentificarea...
        </h2>
        <p className="text-gray-600">Te rugăm să aștepți în timp ce verificăm credențialele.</p>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
