'use client';

import { useQuery } from '@apollo/client/react';
import { GET_DASHBOARD_DATA } from '@/graphql/queries';

// ============================================
// Types
// ============================================

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  type: string;
  client: {
    id: string;
    name: string;
  } | null;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  } | null;
}

interface DashboardData {
  cases: Case[];
  myTasks: Task[];
}

// ============================================
// Hook
// ============================================

export function useDashboard() {
  const { data, loading, error, refetch } = useQuery<DashboardData>(GET_DASHBOARD_DATA, {
    fetchPolicy: 'cache-and-network',
  });

  // Get recent cases (last 5 updated)
  const recentCases =
    data?.cases
      ?.slice()
      .sort((a: Case, b: Case) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5) ?? [];

  // Get urgent/due soon tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgentTasks =
    data?.myTasks?.filter((task: Task) => {
      if (task.priority === 'Urgent') return true;
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Due today or overdue
      return dueDate <= today;
    }) ?? [];

  // Get pending tasks count
  const pendingTasksCount =
    data?.myTasks?.filter((task: Task) => task.status === 'Pending' || task.status === 'InProgress')
      .length ?? 0;

  // Get active cases count
  const activeCasesCount = data?.cases?.length ?? 0;

  return {
    recentCases,
    urgentTasks,
    pendingTasksCount,
    activeCasesCount,
    allTasks: data?.myTasks ?? [],
    loading,
    error,
    refetch,
  };
}
