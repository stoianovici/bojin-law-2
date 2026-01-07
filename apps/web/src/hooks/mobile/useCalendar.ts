'use client';

import { useQuery } from '@apollo/client/react';
import { GET_MY_TASKS } from '@/graphql/queries';
import { Task, TaskFilterInput } from './useMyTasks';

// Task types that are considered calendar events
const EVENT_TYPES = ['Meeting', 'CourtDate', 'BusinessTrip'];

interface GetMyTasksData {
  myTasks: Task[];
}

interface GetMyTasksVariables {
  filters?: TaskFilterInput;
}

interface UseCalendarResult {
  events: Task[];
  tasks: Task[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

export function useCalendar(startDate: string, endDate: string): UseCalendarResult {
  const { data, loading, error, refetch } = useQuery<GetMyTasksData, GetMyTasksVariables>(
    GET_MY_TASKS,
    {
      variables: {
        filters: {
          dueDateFrom: startDate,
          dueDateTo: endDate,
        },
      },
      fetchPolicy: 'cache-and-network',
    }
  );

  const handleRefetch = async () => {
    await refetch();
  };

  const allTasks = data?.myTasks ?? [];

  // Separate into events and tasks based on type
  const events = allTasks.filter((t) => EVENT_TYPES.includes(t.type));
  const tasks = allTasks.filter((t) => !EVENT_TYPES.includes(t.type));

  return {
    events,
    tasks,
    loading,
    error: error ? new Error(error.message) : undefined,
    refetch: handleRefetch,
  };
}
