'use client';

import { useEffect, useRef } from 'react';
import { apolloClient } from '@/lib/apollo-client';
import { useAuthStore } from '@/store/authStore';
import {
  GET_FIRM_BRIEFING,
  GET_EMAILS_BY_CASE,
  GET_CASES,
  GET_CLIENTS_WITH_CASES,
} from '@/graphql/queries';
import { GET_UNIFIED_CASE_CONTEXT } from '@/graphql/unified-context';

// ============================================================================
// Data Preload Hook
// ============================================================================
// Warms Apollo cache immediately when user data is available (from store hydration).
// Runs once per session (guarded by sessionStorage + ref).
//
// KEY: Triggers on store hydration, NOT on MSAL verification.
// If user was previously logged in, preload starts instantly on app load.

const SESSION_KEY = 'data-preload-complete';
const MAX_CASE_CONTEXTS = 5;

interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
}

/**
 * Preloads critical data into Apollo cache as soon as user data is available.
 *
 * Triggers immediately when:
 * - Auth store has hydrated from sessionStorage
 * - User exists in store (from previous session)
 *
 * Does NOT wait for MSAL token verification - that happens in parallel.
 *
 * Priority order:
 * 1. Morning briefing (shown immediately on dashboard)
 * 2. Clients with cases (shown on cases page)
 * 3. Emails by case (frequently accessed)
 * 4. Case contexts for top 5 active cases
 */
export function useDataPreload(_isAuthenticated?: boolean) {
  // Read directly from store - triggers on hydration, not MSAL verification
  const { user, _hasHydrated } = useAuthStore();
  const preloadTriggeredRef = useRef(false);

  useEffect(() => {
    // Wait for store to hydrate from sessionStorage
    if (!_hasHydrated) return;

    // Need user data to make authenticated requests
    if (!user) return;

    // Already triggered this mount
    if (preloadTriggeredRef.current) return;

    // Check if we've already preloaded this session
    if (sessionStorage.getItem(SESSION_KEY)) {
      preloadTriggeredRef.current = true;
      return;
    }

    // Mark as triggered immediately to prevent race conditions
    preloadTriggeredRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');

    console.log('[Preload] Store hydrated with user, starting preload immediately');

    // Run preload in background (non-blocking)
    preloadAllData();
  }, [_hasHydrated, user]);
}

async function preloadAllData() {
  const startTime = performance.now();
  console.log('[Preload] Starting data preload...');

  // 1. Preload morning briefing (highest priority - shown on dashboard)
  try {
    await apolloClient.query({
      query: GET_FIRM_BRIEFING,
      fetchPolicy: 'network-only', // Ensure fresh data
    });
    console.log('[Preload] Briefing cached');
  } catch (error) {
    console.warn('[Preload] Briefing failed:', (error as Error).message);
    // Continue with other preloads - failures don't cascade
  }

  // 2. Preload clients with cases (critical for cases page)
  try {
    await apolloClient.query({
      query: GET_CLIENTS_WITH_CASES,
      fetchPolicy: 'network-only',
    });
    console.log('[Preload] Clients with cases cached');
  } catch (error) {
    console.warn('[Preload] Clients with cases failed:', (error as Error).message);
  }

  // 3. Preload emails by case
  try {
    await apolloClient.query({
      query: GET_EMAILS_BY_CASE,
      variables: { limit: 100, offset: 0 },
      fetchPolicy: 'network-only',
    });
    console.log('[Preload] Emails cached');
  } catch (error) {
    console.warn('[Preload] Emails failed:', (error as Error).message);
  }

  // 4. Preload case contexts for top active cases
  try {
    // First, get active cases to know which contexts to preload
    const casesResult = await apolloClient.query<{ cases: CaseData[] }>({
      query: GET_CASES,
      variables: { status: 'Active' },
      fetchPolicy: 'cache-first', // May already be cached from other queries
    });

    const activeCases = casesResult.data?.cases || [];
    const casesToPreload = activeCases.slice(0, MAX_CASE_CONTEXTS);

    if (casesToPreload.length > 0) {
      console.log(`[Preload] Loading context for ${casesToPreload.length} cases`);

      // Preload contexts in parallel for speed
      await Promise.allSettled(
        casesToPreload.map((caseData) =>
          apolloClient.query({
            query: GET_UNIFIED_CASE_CONTEXT,
            variables: { caseId: caseData.id, tier: 'standard' },
            fetchPolicy: 'network-only',
          })
        )
      );
      console.log('[Preload] Case contexts cached');
    }
  } catch (error) {
    console.warn('[Preload] Case contexts failed:', (error as Error).message);
  }

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`[Preload] Complete in ${elapsed}ms`);
}
