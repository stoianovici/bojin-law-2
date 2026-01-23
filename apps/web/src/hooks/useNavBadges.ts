'use client';

import { useEffect, useRef, useMemo } from 'react';
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
  myTasks: Array<{ id: string; createdBy: string }>;
  myCalendarEvents: Array<{ id: string; createdBy: string }>;
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
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { seenCounts, updateSeenCount } = useNavBadgesStore();
  const prevSectionRef = useRef<string | null>(null);

  const shouldSkip = authLoading || !isAuthenticated || !user?.id;

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

  // Calculate raw counts from query data, filtering out self-created items
  // (Items where the user created and assigned to themselves shouldn't show badge)
  const userId = user?.id;

  const rawCounts = useMemo<NavBadgeCounts>(() => {
    // Filter tasks: exclude self-created items (createdBy === userId means user created it for themselves)
    const relevantTasks = data?.myTasks?.filter((task) => task.createdBy !== userId) ?? [];
    const relevantCalendarEvents =
      data?.myCalendarEvents?.filter((event) => event.createdBy !== userId) ?? [];

    return {
      email: data?.emailStats?.unreadEmails ?? 0,
      tasks: relevantTasks.length,
      calendar: relevantCalendarEvents.length,
      documents: 0, // Documents don't have a count yet
    };
  }, [data, userId]);

  // Check if current section is active
  const activeSection = getNavSection(pathname);

  // Update seen count when user visits a section
  // This ensures badge stays dismissed until NEW items arrive
  useEffect(() => {
    if (activeSection && activeSection !== prevSectionRef.current) {
      // User navigated to a new section - update the seen count
      const currentCount = rawCounts[activeSection];
      updateSeenCount(activeSection, currentCount);
      prevSectionRef.current = activeSection;
    }
  }, [activeSection, rawCounts, updateSeenCount]);

  // Calculate display counts: show only NEW items (current - seen)
  // When on the active section, show 0
  const displayCounts: NavBadgeCounts = {
    email: activeSection === 'email' ? 0 : Math.max(0, rawCounts.email - (seenCounts.email ?? 0)),
    tasks: activeSection === 'tasks' ? 0 : Math.max(0, rawCounts.tasks - (seenCounts.tasks ?? 0)),
    calendar:
      activeSection === 'calendar'
        ? 0
        : Math.max(0, rawCounts.calendar - (seenCounts.calendar ?? 0)),
    documents: 0,
  };

  return {
    counts: displayCounts,
    loading: authLoading || loading,
  };
}
