# Story 20: Authentication System

**Parallelizable with**: NONE - run after Phase 1 complete (story-16)
**Depends on**: UI Components (Phase 1)
**Blocks**: Phase 3 (Layout), Phase 4 (Pages)

---

## Parallel Group A: Auth Foundation

> These 3 tasks run simultaneously (different files)

### Task A1: Create Auth Store

**File**: `src/store/authStore.ts` (CREATE)

**Do**:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
  firmId: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  graphToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, graphToken?: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      graphToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (accessToken, graphToken) => set({ accessToken, graphToken }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          graphToken: null,
          isAuthenticated: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Security: session only
      partialize: (state) => ({ user: state.user }), // Don't persist tokens
    }
  )
);
```

**Done when**: Store works, persists user to sessionStorage, tokens NOT persisted

---

### Task A2: Create Auth Hook

**File**: `src/hooks/useAuth.ts` (CREATE)

**Do**:

```typescript
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { useAuthStore } from '@/store/authStore';
import { loginRequest, graphScopes, mailScopes } from '@/lib/msal-config';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const { user, isAuthenticated, isLoading, setUser, setTokens, clearAuth, setLoading } =
    useAuthStore();

  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    clearAuth();
    await instance.logoutRedirect();
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      // Fallback to interactive if silent fails
      await instance.acquireTokenRedirect(loginRequest);
      return null;
    }
  };

  const getGraphToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        scopes: graphScopes,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      await instance.acquireTokenRedirect({ scopes: graphScopes });
      return null;
    }
  };

  const getMailToken = async (): Promise<string | null> => {
    // Similar to getGraphToken but with mailScopes
    // Returns null gracefully if user hasn't consented
  };

  return {
    user,
    isAuthenticated: msalAuthenticated && isAuthenticated,
    isLoading,
    login,
    logout,
    getAccessToken,
    getGraphToken,
    getMailToken,
  };
}
```

**Done when**: Hook abstracts MSAL, silent token refresh works, handles interaction_required

---

### Task A3: Update MSAL Config

**File**: `src/lib/msal-config.ts` (MODIFY)

**Do**: Add missing scopes and organize:

```typescript
// API scopes (your backend)
export const apiScopes = ['api://your-api-client-id/access_as_user'];

// Microsoft Graph scopes
export const graphScopes = ['User.Read', 'User.ReadBasic.All'];

// Mail scopes (separate for incremental consent)
export const mailScopes = ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'];

// Default login request
export const loginRequest = {
  scopes: [...apiScopes, ...graphScopes],
};

// For re-consent flow
export const consentRequest = {
  scopes: [...apiScopes, ...graphScopes, ...mailScopes],
  prompt: 'consent',
};
```

**Done when**: New scopes defined, backward compatible with existing config

---

## Sequential: After Group A

### Task B: Create Auth Provider

**File**: `src/providers/AuthProvider.tsx` (CREATE)

**Depends on**: Tasks A1, A2, A3

**Do**:

```typescript
'use client'

import { MsalProvider, useMsalAuthentication } from '@azure/msal-react'
import { PublicClientApplication, InteractionType } from '@azure/msal-browser'
import { msalConfig, loginRequest } from '@/lib/msal-config'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'

const msalInstance = new PublicClientApplication(msalConfig)

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setTokens } = useAuthStore()
  const { result, error } = useMsalAuthentication(InteractionType.Silent, loginRequest)

  useEffect(() => {
    if (result) {
      // Fetch user profile from your API
      fetchUserProfile(result.accessToken)
        .then(user => {
          setUser(user)
          setTokens(result.accessToken)
        })
        .finally(() => setLoading(false))
    } else if (error) {
      setLoading(false)
    }
  }, [result, error])

  return <>{children}</>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthInitializer>
        {children}
      </AuthInitializer>
    </MsalProvider>
  )
}
```

**Done when**: Provider wraps app, handles MSAL lifecycle, initializes auth store

---

## Parallel Group C: Auth UI

> These 2 tasks run simultaneously (different files)

### Task C1: Create Login Page

**File**: `src/app/(auth)/login/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/'

  useEffect(() => {
    if (isAuthenticated) {
      router.push(returnUrl)
    }
  }, [isAuthenticated, returnUrl, router])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Legal Platform V2</CardTitle>
          <p className="text-linear-text-secondary">
            Conectați-vă pentru a continua
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={login} className="w-full">
            Conectare cu Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Done when**: Login page renders, Microsoft button triggers login, redirects after success

---

### Task C2: Create Auth Callback Page

**File**: `src/app/(auth)/auth/callback/page.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const { instance } = useMsal()
  const router = useRouter()

  useEffect(() => {
    instance.handleRedirectPromise()
      .then((response) => {
        if (response) {
          // Token acquired, redirect to intended destination
          const returnUrl = sessionStorage.getItem('returnUrl') || '/'
          sessionStorage.removeItem('returnUrl')
          router.push(returnUrl)
        } else {
          router.push('/')
        }
      })
      .catch((error) => {
        console.error('Auth callback error:', error)
        router.push('/login?error=callback_failed')
      })
  }, [instance, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-bg-primary">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-linear-text-secondary">Se procesează autentificarea...</p>
      </div>
    </div>
  )
}
```

**Done when**: Handles MSAL redirect, extracts tokens, redirects to returnUrl

---

## Sequential: After Group C

### Task D: Update Root Layout

**File**: `src/app/layout.tsx` (MODIFY)

**Depends on**: Task B (AuthProvider)

**Do**: Add AuthProvider wrapper in correct order:

```typescript
// Provider order: Theme > Auth > Apollo > Toast
<ThemeProvider>
  <AuthProvider>
    <ApolloProvider>
      <TooltipProvider>
        {children}
        <ToastViewport />
      </TooltipProvider>
    </ApolloProvider>
  </AuthProvider>
</ThemeProvider>
```

**Done when**: Auth available throughout app, build passes

---

## Done when (entire story)

- Auth store persists user (not tokens) to sessionStorage
- `useAuth` hook provides login/logout/token methods
- MSAL scopes include Mail permissions
- Login page works with Microsoft auth
- Callback handles redirect
- Root layout includes AuthProvider
- Build passes
