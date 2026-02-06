'use client';

import { useEffect, useRef } from 'react';
import { apolloClient } from '@/lib/apollo-client';
import { GET_FIRM_BRIEFING, GET_EMAILS_BY_CASE, GET_CASES } from '@/graphql/queries';
import { GET_UNIFIED_CASE_CONTEXT } from '@/graphql/unified-context';

// ============================================================================
// Data Preload Hook
// ============================================================================
// Warms Apollo cache immediately after authentication to eliminate loading states.
// Runs once per session (guarded by sessionStorage + ref).

const SESSION_KEY = 'data-preload-complete';
const MAX_CASE_CONTEXTS = 5;

interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
}

/**
 * Preloads critical data into Apollo cache after user authentication.
 *
 * Priority order:
 * 1. Morning briefing (shown immediately on dashboard)
 * 2. Emails by case (frequently accessed, heavy query)
 * 3. Case contexts for top 5 active cases
 */
export function useDataPreload(isAuthenticated: boolean) {
  const preloadTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || preloadTriggeredRef.current) return;

    // Check if we've already preloaded this session
    if (sessionStorage.getItem(SESSION_KEY)) {
      preloadTriggeredRef.current = true;
      return;
    }

    // Mark as triggered immediately to prevent race conditions
    preloadTriggeredRef.current = true;
    sessionStorage.setItem(SESSION_KEY, 'true');

    // Run preload in background (non-blocking)
    preloadAllData();
  }, [isAuthenticated]);
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

  // 2. Preload emails by case (frequently accessed)
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

  // 3. Preload case contexts for top active cases
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
