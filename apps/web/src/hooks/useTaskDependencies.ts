import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type {
  TaskDependency,
  DependencyType,
  CriticalPathResult,
  ParallelTaskGroup,
  DeadlineCascadeResult,
  Task,
} from '@legal-platform/types';

// Query/Mutation response types
interface GetTaskDependenciesData {
  taskDependencies: TaskDependency[];
}

interface GetBlockedTasksData {
  blockedTasks: Task[];
}

interface GetCriticalPathData {
  criticalPath: CriticalPathResult | null;
}

interface GetParallelTasksData {
  parallelTasks: ParallelTaskGroup[];
}

interface AddTaskDependencyData {
  addTaskDependency: TaskDependency;
}

interface RemoveTaskDependencyData {
  removeTaskDependency: boolean;
}

interface PreviewDeadlineCascadeData {
  previewDeadlineCascade: DeadlineCascadeResult;
}

interface ApplyDeadlineCascadeData {
  applyDeadlineCascade: Task[];
}

interface RecalculateCriticalPathData {
  recalculateCriticalPath: CriticalPathResult;
}

// GraphQL Queries
const GET_TASK_DEPENDENCIES = gql`
  query GetTaskDependencies($taskId: ID!) {
    taskDependencies(taskId: $taskId) {
      id
      predecessorId
      predecessor {
        id
        title
        dueDate
        status
      }
      successorId
      successor {
        id
        title
        dueDate
        status
      }
      dependencyType
      lagDays
      createdAt
    }
  }
`;

const GET_BLOCKED_TASKS = gql`
  query GetBlockedTasks($caseId: ID!) {
    blockedTasks(caseId: $caseId) {
      id
      title
      dueDate
      status
      isBlocked
      blockedReason
      isCriticalPath
    }
  }
`;

const GET_CRITICAL_PATH = gql`
  query GetCriticalPath($caseId: ID!) {
    criticalPath(caseId: $caseId) {
      caseId
      criticalTasks {
        id
        title
        dueDate
        status
        estimatedHours
        isCriticalPath
      }
      totalDuration
      estimatedCompletionDate
      bottlenecks {
        taskId
        taskTitle
        dependentCount
        slackDays
      }
    }
  }
`;

const GET_PARALLEL_TASKS = gql`
  query GetParallelTasks($caseId: ID!) {
    parallelTasks(caseId: $caseId) {
      groupId
      tasks {
        id
        title
        type
        dueDate
        status
        estimatedHours
      }
      canRunSimultaneously
      suggestedAssignees {
        userId
        user {
          id
          name
          email
        }
        matchScore
        currentWorkload
        availableCapacity
        reasoning
      }
    }
  }
`;

// GraphQL Mutations
const ADD_TASK_DEPENDENCY = gql`
  mutation AddTaskDependency(
    $predecessorId: ID!
    $successorId: ID!
    $type: DependencyType!
    $lagDays: Int
  ) {
    addTaskDependency(
      predecessorId: $predecessorId
      successorId: $successorId
      type: $type
      lagDays: $lagDays
    ) {
      id
      predecessorId
      successorId
      dependencyType
      lagDays
    }
  }
`;

const REMOVE_TASK_DEPENDENCY = gql`
  mutation RemoveTaskDependency($dependencyId: ID!) {
    removeTaskDependency(dependencyId: $dependencyId)
  }
`;

const PREVIEW_DEADLINE_CASCADE = gql`
  mutation PreviewDeadlineCascade($taskId: ID!, $newDueDate: Date!) {
    previewDeadlineCascade(taskId: $taskId, newDueDate: $newDueDate) {
      affectedTasks {
        taskId
        taskTitle
        currentDueDate
        newDueDate
        daysDelta
      }
      conflicts {
        taskId
        taskTitle
        conflictType
        message
        severity
      }
      suggestedResolution
    }
  }
`;

const APPLY_DEADLINE_CASCADE = gql`
  mutation ApplyDeadlineCascade($taskId: ID!, $newDueDate: Date!, $confirmConflicts: Boolean!) {
    applyDeadlineCascade(
      taskId: $taskId
      newDueDate: $newDueDate
      confirmConflicts: $confirmConflicts
    ) {
      id
      title
      dueDate
      status
    }
  }
`;

const RECALCULATE_CRITICAL_PATH = gql`
  mutation RecalculateCriticalPath($caseId: ID!) {
    recalculateCriticalPath(caseId: $caseId) {
      caseId
      criticalTasks {
        id
        title
        dueDate
        isCriticalPath
      }
      totalDuration
      estimatedCompletionDate
      bottlenecks {
        taskId
        taskTitle
        dependentCount
        slackDays
      }
    }
  }
`;

// Hook: Get task dependencies
export function useTaskDependencies(taskId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetTaskDependenciesData>(
    GET_TASK_DEPENDENCIES,
    {
      variables: { taskId },
      skip: !taskId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    dependencies: data?.taskDependencies || [],
    loading,
    error,
    refetch,
  };
}

// Hook: Get blocked tasks
export function useBlockedTasks(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetBlockedTasksData>(GET_BLOCKED_TASKS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    blockedTasks: data?.blockedTasks || [],
    loading,
    error,
    refetch,
  };
}

// Hook: Get critical path
export function useCriticalPath(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetCriticalPathData>(GET_CRITICAL_PATH, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    criticalPath: data?.criticalPath ?? null,
    loading,
    error,
    refetch,
  };
}

// Hook: Get parallel tasks
export function useParallelTasks(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetParallelTasksData>(GET_PARALLEL_TASKS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    parallelTaskGroups: data?.parallelTasks || [],
    loading,
    error,
    refetch,
  };
}

// Hook: Add dependency
export function useAddDependency() {
  const [mutate, { data, loading, error }] = useMutation<AddTaskDependencyData>(
    ADD_TASK_DEPENDENCY,
    {
      refetchQueries: ['taskDependencies', 'tasks'],
    }
  );

  const addDependency = async (
    predecessorId: string,
    successorId: string,
    type: DependencyType = 'FinishToStart',
    lagDays?: number
  ) => {
    const result = await mutate({
      variables: { predecessorId, successorId, type, lagDays },
    });
    return result.data?.addTaskDependency;
  };

  return [addDependency, { data, loading, error }] as const;
}

// Hook: Remove dependency
export function useRemoveDependency() {
  const [mutate, { data, loading, error }] = useMutation<RemoveTaskDependencyData>(
    REMOVE_TASK_DEPENDENCY,
    {
      refetchQueries: ['taskDependencies', 'tasks'],
    }
  );

  const removeDependency = async (dependencyId: string) => {
    const result = await mutate({ variables: { dependencyId } });
    return result.data?.removeTaskDependency;
  };

  return [removeDependency, { data, loading, error }] as const;
}

// Hook: Preview deadline cascade
export function usePreviewCascade() {
  const [mutate, { data, loading, error }] =
    useMutation<PreviewDeadlineCascadeData>(PREVIEW_DEADLINE_CASCADE);

  const previewCascade = async (taskId: string, newDueDate: Date) => {
    const result = await mutate({ variables: { taskId, newDueDate } });
    return result.data?.previewDeadlineCascade;
  };

  return [previewCascade, { data, loading, error }] as const;
}

// Hook: Apply deadline cascade
export function useApplyCascade() {
  const [mutate, { data, loading, error }] = useMutation<ApplyDeadlineCascadeData>(
    APPLY_DEADLINE_CASCADE,
    {
      refetchQueries: ['tasks', 'taskDependencies', 'criticalPath'],
    }
  );

  const applyCascade = async (taskId: string, newDueDate: Date, confirmConflicts: boolean) => {
    const result = await mutate({ variables: { taskId, newDueDate, confirmConflicts } });
    return result.data?.applyDeadlineCascade;
  };

  return [applyCascade, { data, loading, error }] as const;
}

// Hook: Recalculate critical path
export function useRecalculateCriticalPath() {
  const [mutate, { data, loading, error }] = useMutation<RecalculateCriticalPathData>(
    RECALCULATE_CRITICAL_PATH,
    {
      refetchQueries: ['criticalPath', 'tasks'],
    }
  );

  const recalculateCriticalPath = async (caseId: string) => {
    const result = await mutate({ variables: { caseId } });
    return result.data?.recalculateCriticalPath;
  };

  return [recalculateCriticalPath, { data, loading, error }] as const;
}
