'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login, devLogin, isDevMode } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const returnUrl = searchParams.get('returnUrl') || '/';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace(returnUrl);
    }
  }, [isAuthenticated, isLoading, router, returnUrl]);

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = devLogin(username, password);
    if (!success) {
      setError('Invalid credentials. Use test/test');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-linear-text-secondary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-linear-2xl">Legal Platform V2</CardTitle>
          <CardDescription className="text-linear-base text-linear-text-secondary">
            Conectați-vă pentru a continua
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDevMode && (
            <form onSubmit={handleDevLogin} className="space-y-3">
              <div className="text-xs text-linear-text-tertiary text-center mb-2">
                Dev Mode - Use test/test
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-linear-bg-secondary border border-linear-border-primary rounded-md text-linear-text-primary placeholder:text-linear-text-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent-primary"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-linear-bg-secondary border border-linear-border-primary rounded-md text-linear-text-primary placeholder:text-linear-text-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent-primary"
              />
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
              <Button type="submit" size="lg" className="w-full">
                Login (Dev)
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-linear-border-primary" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-linear-bg-primary px-2 text-linear-text-tertiary">or</span>
                </div>
              </div>
            </form>
          )}
          <Button
            onClick={() => login()}
            size="lg"
            variant={isDevMode ? 'secondary' : 'primary'}
            className="w-full"
          >
            Conectare cu Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <Loader2 className="h-8 w-8 animate-spin text-linear-text-secondary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
