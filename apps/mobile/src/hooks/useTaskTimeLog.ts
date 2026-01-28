'use client';

import { useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_TIME_ENTRIES_BY_TASK } from '@/graphql/queries';
import { LOG_TIME_AGAINST_TASK } from '@/graphql/mutations';

// ============================================
// Types
// ============================================

export interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface TimeEntriesData {
  timeEntriesByTask: TimeEntry[];
}

// ============================================
// Hook
// ============================================

export function useTaskTimeLog(taskId: string | null) {
  // Fetch time entries for the task
  const { data, loading, refetch } = useQuery<TimeEntriesData>(GET_TIME_ENTRIES_BY_TASK, {
    variables: { taskId },
    skip: !taskId,
    fetchPolicy: 'cache-and-network',
  });

  // Log time mutation
  const [logTimeMutation, { loading: logging }] = useMutation(LOG_TIME_AGAINST_TASK, {
    refetchQueries: taskId ? [{ query: GET_TIME_ENTRIES_BY_TASK, variables: { taskId } }] : [],
  });

  // Entries sorted by date (newest first)
  const entries = useMemo(() => {
    return [...(data?.timeEntriesByTask ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [data?.timeEntriesByTask]);

  // Calculate total hours
  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  // Log time function
  const logTime = async (hours: number, description: string) => {
    if (!taskId) return;

    await logTimeMutation({
      variables: {
        taskId,
        hours,
        description,
        billable: true,
      },
    });
  };

  return {
    entries,
    totalHours,
    loading,
    logging,
    logTime,
    refetch,
  };
}
