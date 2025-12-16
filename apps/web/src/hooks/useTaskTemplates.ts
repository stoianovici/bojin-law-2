import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type {
  TaskTemplate,
  CaseType,
  ApplyTemplateResult,
  ApplyTemplateInput,
} from '@legal-platform/types';

// Query/Mutation response types
interface GetTaskTemplatesData {
  taskTemplates: TaskTemplate[];
}

interface GetTaskTemplateData {
  taskTemplate: TaskTemplate | null;
}

interface GetDefaultTemplateData {
  defaultTemplate: TaskTemplate | null;
}

interface CreateTaskTemplateData {
  createTaskTemplate: TaskTemplate;
}

interface UpdateTaskTemplateData {
  updateTaskTemplate: TaskTemplate;
}

interface DeleteTaskTemplateData {
  deleteTaskTemplate: boolean;
}

interface DuplicateTaskTemplateData {
  duplicateTaskTemplate: TaskTemplate;
}

interface ApplyTemplateData {
  applyTemplate: ApplyTemplateResult;
}

// GraphQL Queries
const GET_TASK_TEMPLATES = gql`
  query GetTaskTemplates($caseType: CaseType, $activeOnly: Boolean) {
    taskTemplates(caseType: $caseType, activeOnly: $activeOnly) {
      id
      firmId
      name
      description
      caseType
      isDefault
      isActive
      createdBy
      createdAt
      updatedAt
      usageCount
      steps {
        id
        templateId
        stepOrder
        taskType
        title
        description
        estimatedHours
        typeMetadata
        offsetDays
        offsetFrom
        isParallel
        isCriticalPath
        dependencies {
          id
          sourceStepId
          targetStepId
          dependencyType
          lagDays
        }
        dependents {
          id
          sourceStepId
          targetStepId
          dependencyType
          lagDays
        }
      }
    }
  }
`;

const GET_TASK_TEMPLATE = gql`
  query GetTaskTemplate($id: ID!) {
    taskTemplate(id: $id) {
      id
      firmId
      name
      description
      caseType
      isDefault
      isActive
      createdBy
      createdAt
      updatedAt
      usageCount
      steps {
        id
        templateId
        stepOrder
        taskType
        title
        description
        estimatedHours
        typeMetadata
        offsetDays
        offsetFrom
        isParallel
        isCriticalPath
        dependencies {
          id
          sourceStepId
          targetStepId
          dependencyType
          lagDays
        }
        dependents {
          id
          sourceStepId
          targetStepId
          dependencyType
          lagDays
        }
      }
    }
  }
`;

const GET_DEFAULT_TEMPLATE = gql`
  query GetDefaultTemplate($caseType: CaseType) {
    defaultTemplate(caseType: $caseType) {
      id
      firmId
      name
      description
      caseType
      isDefault
      isActive
      createdBy
      createdAt
      updatedAt
      usageCount
      steps {
        id
        templateId
        stepOrder
        taskType
        title
        description
        estimatedHours
        typeMetadata
        offsetDays
        offsetFrom
        isParallel
        isCriticalPath
        dependencies {
          id
          sourceStepId
          targetStepId
          dependencyType
          lagDays
        }
      }
    }
  }
`;

// GraphQL Mutations
const CREATE_TASK_TEMPLATE = gql`
  mutation CreateTaskTemplate($input: CreateTaskTemplateInput!) {
    createTaskTemplate(input: $input) {
      id
      name
      description
      caseType
      isDefault
      isActive
    }
  }
`;

const UPDATE_TASK_TEMPLATE = gql`
  mutation UpdateTaskTemplate($id: ID!, $input: CreateTaskTemplateInput!) {
    updateTaskTemplate(id: $id, input: $input) {
      id
      name
      description
      caseType
      isDefault
      isActive
    }
  }
`;

const DELETE_TASK_TEMPLATE = gql`
  mutation DeleteTaskTemplate($id: ID!) {
    deleteTaskTemplate(id: $id)
  }
`;

const DUPLICATE_TASK_TEMPLATE = gql`
  mutation DuplicateTaskTemplate($id: ID!, $newName: String!) {
    duplicateTaskTemplate(id: $id, newName: $newName) {
      id
      name
      description
      caseType
      isDefault
      isActive
    }
  }
`;

const APPLY_TEMPLATE = gql`
  mutation ApplyTemplate($input: ApplyTemplateInput!) {
    applyTemplate(input: $input) {
      usageId
      createdTasks {
        id
        title
        dueDate
        assignedTo
        status
      }
      dependenciesCreated
      warnings
    }
  }
`;

// Hook: Get list of templates
export function useTaskTemplates(filters?: { caseType?: CaseType; activeOnly?: boolean }) {
  const { data, loading, error, refetch } = useQuery<GetTaskTemplatesData>(GET_TASK_TEMPLATES, {
    variables: filters,
    fetchPolicy: 'cache-and-network',
  });

  return {
    templates: data?.taskTemplates || [],
    loading,
    error,
    refetch,
  };
}

// Hook: Get single template
export function useTaskTemplate(id: string | null) {
  const { data, loading, error, refetch } = useQuery<GetTaskTemplateData>(GET_TASK_TEMPLATE, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  return {
    template: data?.taskTemplate ?? null,
    loading,
    error,
    refetch,
  };
}

// Hook: Get default template for case type
export function useDefaultTemplate(caseType?: CaseType) {
  const { data, loading, error } = useQuery<GetDefaultTemplateData>(GET_DEFAULT_TEMPLATE, {
    variables: { caseType },
    skip: !caseType,
  });

  return {
    template: data?.defaultTemplate ?? null,
    loading,
    error,
  };
}

// Hook: Create template
export function useCreateTemplate() {
  const [mutate, { data, loading, error }] = useMutation<CreateTaskTemplateData>(
    CREATE_TASK_TEMPLATE,
    {
      refetchQueries: [{ query: GET_TASK_TEMPLATES }],
    }
  );

  const createTemplate = async (input: Record<string, unknown>) => {
    const result = await mutate({ variables: { input } });
    return result.data?.createTaskTemplate;
  };

  return [createTemplate, { data, loading, error }] as const;
}

// Hook: Update template
export function useUpdateTemplate() {
  const [mutate, { data, loading, error }] = useMutation<UpdateTaskTemplateData>(
    UPDATE_TASK_TEMPLATE,
    {
      refetchQueries: [{ query: GET_TASK_TEMPLATES }],
    }
  );

  const updateTemplate = async (id: string, input: Record<string, unknown>) => {
    const result = await mutate({ variables: { id, input } });
    return result.data?.updateTaskTemplate;
  };

  return [updateTemplate, { data, loading, error }] as const;
}

// Hook: Delete template
export function useDeleteTemplate() {
  const [mutate, { data, loading, error }] = useMutation<DeleteTaskTemplateData>(
    DELETE_TASK_TEMPLATE,
    {
      refetchQueries: [{ query: GET_TASK_TEMPLATES }],
    }
  );

  const deleteTemplate = async (id: string) => {
    const result = await mutate({ variables: { id } });
    return result.data?.deleteTaskTemplate;
  };

  return [deleteTemplate, { data, loading, error }] as const;
}

// Hook: Duplicate template
export function useDuplicateTemplate() {
  const [mutate, { data, loading, error }] = useMutation<DuplicateTaskTemplateData>(
    DUPLICATE_TASK_TEMPLATE,
    {
      refetchQueries: [{ query: GET_TASK_TEMPLATES }],
    }
  );

  const duplicateTemplate = async (id: string, newName: string) => {
    const result = await mutate({ variables: { id, newName } });
    return result.data?.duplicateTaskTemplate;
  };

  return [duplicateTemplate, { data, loading, error }] as const;
}

// Hook: Apply template to case
export function useApplyTemplate() {
  const [mutate, { data, loading, error }] = useMutation<ApplyTemplateData>(APPLY_TEMPLATE, {
    refetchQueries: ['tasks', 'taskDependencies'],
  });

  const applyTemplate = async (input: ApplyTemplateInput) => {
    const result = await mutate({ variables: { input } });
    return result.data?.applyTemplate;
  };

  return [applyTemplate, { data, loading, error }] as const;
}
