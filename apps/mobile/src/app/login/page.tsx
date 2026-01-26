'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('[Login] Failed:', error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Bojin Law</h1>
          <p className="mt-2 text-sm text-text-secondary">Platformă de management juridic</p>
        </div>

        {/* Login Button */}
        <Button onClick={handleLogin} loading={isLoading} fullWidth size="lg" className="mb-4">
          Autentificare cu Microsoft
        </Button>

        {/* Info */}
        <p className="text-xs text-text-tertiary">
          Folosește contul tău Microsoft 365 pentru a te autentifica.
        </p>
      </div>
    </div>
  );
}
