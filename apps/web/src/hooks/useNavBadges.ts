'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from './useGraphQL';
import { useAuth } from './useAuth';
import { useNavBadgesStore } from '@/store/navBadgesStore';
import { GET_NAV_BADGE_COUNTS } from '@/graphql/queries';

interface NavBadgeCounts {
  email: number;
  tasks: number;
  calendar: number;
  documents: number;
}

interface NavBadgeCountsQueryResult {
  emailStats: {
    unreadEmails: number;
  };
  myTasks: Array<{ id: string }>;
  tasks: Array<{ id: string }>;
}

// Map pathname to nav section
function getNavSection(pathname: string): 'email' | 'tasks' | 'calendar' | 'documents' | null {
  if (pathname.startsWith('/email')) return 'email';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/documents')) return 'documents';
  return null;
}

const POLL_INTERVAL = 60000; // 60 seconds

export function useNavBadges() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { markViewed } = useNavBadgesStore();

  const shouldSkip = authLoading || !isAuthenticated;

  // Query for badge counts
  const { data, loading, refetch } = useQuery<NavBadgeCountsQueryResult>(GET_NAV_BADGE_COUNTS, {
    skip: shouldSkip,
  });

  // Set up polling
  useEffect(() => {
    if (shouldSkip) return;

    const interval = setInterval(() => {
      refetch();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [shouldSkip, refetch]);

  // Mark current section as viewed when pathname changes
  useEffect(() => {
    const section = getNavSection(pathname);
    if (section) {
      markViewed(section);
    }
  }, [pathname, markViewed]);

  // Calculate counts from query data
  const counts: NavBadgeCounts = {
    email: data?.emailStats?.unreadEmails ?? 0,
    tasks: data?.myTasks?.length ?? 0,
    calendar: data?.tasks?.length ?? 0,
    documents: 0, // Documents don't have a count yet
  };

  // Check if current section is active (to hide its badge)
  const activeSection = getNavSection(pathname);

  // Return counts with active section's count set to 0
  const displayCounts: NavBadgeCounts = {
    ...counts,
    ...(activeSection ? { [activeSection]: 0 } : {}),
  };

  return {
    counts: displayCounts,
    loading: authLoading || loading,
  };
}
