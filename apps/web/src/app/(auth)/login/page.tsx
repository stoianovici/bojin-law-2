'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login } = useAuth();

  const returnUrl = searchParams.get('returnUrl') || '/';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace(returnUrl);
    }
  }, [isAuthenticated, isLoading, router, returnUrl]);

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
          <CardTitle className="text-linear-2xl">Legal Platform</CardTitle>
          <CardDescription className="text-linear-base text-linear-text-secondary">
            Conectați-vă pentru a continua
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => login()} size="lg" className="w-full">
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
