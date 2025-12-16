/**
 * Communication Templates React Hooks
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Provides hooks for managing and using communication templates
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const TEMPLATE_VARIABLE_FRAGMENT = gql`
  fragment TemplateVariableFields on TemplateVariable {
    name
    description
    defaultValue
    required
  }
`;

const COMMUNICATION_TEMPLATE_FRAGMENT = gql`
  ${TEMPLATE_VARIABLE_FRAGMENT}
  fragment CommunicationTemplateFields on CommunicationTemplate {
    id
    name
    description
    category
    channelType
    subject
    body
    htmlBody
    variables {
      ...TemplateVariableFields
    }
    isActive
    isGlobal
    usageCount
    lastUsedAt
    createdBy {
      id
      firstName
      lastName
    }
    createdAt
  }
`;

const RENDERED_TEMPLATE_FRAGMENT = gql`
  fragment RenderedTemplateFields on RenderedTemplate {
    subject
    body
    htmlBody
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_TEMPLATES = gql`
  ${COMMUNICATION_TEMPLATE_FRAGMENT}
  query GetCommunicationTemplates(
    $category: TemplateCategory
    $channelType: CommunicationChannel
    $searchTerm: String
  ) {
    communicationTemplates(
      category: $category
      channelType: $channelType
      searchTerm: $searchTerm
    ) {
      ...CommunicationTemplateFields
    }
  }
`;

const GET_TEMPLATE = gql`
  ${COMMUNICATION_TEMPLATE_FRAGMENT}
  query GetCommunicationTemplate($id: ID!) {
    communicationTemplate(id: $id) {
      ...CommunicationTemplateFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CREATE_TEMPLATE = gql`
  ${COMMUNICATION_TEMPLATE_FRAGMENT}
  mutation CreateCommunicationTemplate($input: CreateTemplateInput!) {
    createCommunicationTemplate(input: $input) {
      ...CommunicationTemplateFields
    }
  }
`;

const UPDATE_TEMPLATE = gql`
  ${COMMUNICATION_TEMPLATE_FRAGMENT}
  mutation UpdateCommunicationTemplate($id: ID!, $input: UpdateTemplateInput!) {
    updateCommunicationTemplate(id: $id, input: $input) {
      ...CommunicationTemplateFields
    }
  }
`;

const DELETE_TEMPLATE = gql`
  mutation DeleteCommunicationTemplate($id: ID!) {
    deleteCommunicationTemplate(id: $id)
  }
`;

const RENDER_TEMPLATE = gql`
  ${RENDERED_TEMPLATE_FRAGMENT}
  mutation RenderTemplate($input: RenderTemplateInput!) {
    renderTemplate(input: $input) {
      ...RenderedTemplateFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type TemplateCategory =
  | 'ClientUpdate'
  | 'CourtFiling'
  | 'AppointmentReminder'
  | 'DocumentRequest'
  | 'InvoiceReminder'
  | 'CaseOpening'
  | 'CaseClosing'
  | 'General';

export type CommunicationChannel =
  | 'Email'
  | 'InternalNote'
  | 'WhatsApp'
  | 'Phone'
  | 'Meeting'
  | 'SMS';

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  channelType: CommunicationChannel;
  subject?: string;
  body: string;
  htmlBody?: string;
  variables: TemplateVariable[];
  isActive: boolean;
  isGlobal: boolean;
  usageCount: number;
  lastUsedAt?: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  channelType: CommunicationChannel;
  subject?: string;
  body: string;
  htmlBody?: string;
  variables?: TemplateVariable[];
  isGlobal?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  subject?: string;
  body?: string;
  htmlBody?: string;
  variables?: TemplateVariable[];
  isGlobal?: boolean;
  isActive?: boolean;
}

export interface RenderedTemplate {
  subject?: string;
  body: string;
  htmlBody?: string;
}

export interface TemplateFilter {
  category?: TemplateCategory;
  channelType?: CommunicationChannel;
  searchTerm?: string;
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface GetTemplatesData {
  communicationTemplates: CommunicationTemplate[];
}

interface GetTemplateData {
  communicationTemplate: CommunicationTemplate | null;
}

interface CreateTemplateData {
  createCommunicationTemplate: CommunicationTemplate;
}

interface UpdateTemplateData {
  updateCommunicationTemplate: CommunicationTemplate;
}

interface DeleteTemplateData {
  deleteCommunicationTemplate: boolean;
}

interface RenderTemplateData {
  renderTemplate: RenderedTemplate;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for listing templates with optional filters
 */
export function useTemplates(filter?: TemplateFilter) {
  const { data, loading, error, refetch } = useQuery<GetTemplatesData>(GET_TEMPLATES, {
    variables: filter || {},
    fetchPolicy: 'cache-and-network',
  });

  return {
    templates: data?.communicationTemplates || [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for getting a single template
 */
export function useTemplate(id: string) {
  const { data, loading, error, refetch } = useQuery<GetTemplateData>(GET_TEMPLATE, {
    variables: { id },
    skip: !id,
  });

  return {
    template: data?.communicationTemplate ?? undefined,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for creating a new template
 */
export function useCreateTemplate() {
  const [createMutation, { loading, error }] = useMutation<CreateTemplateData>(CREATE_TEMPLATE, {
    refetchQueries: [{ query: GET_TEMPLATES }],
  });

  const create = useCallback(
    async (input: CreateTemplateInput) => {
      const result = await createMutation({
        variables: { input },
      });

      return result.data?.createCommunicationTemplate;
    },
    [createMutation]
  );

  return {
    create,
    loading,
    error,
  };
}

/**
 * Hook for updating an existing template
 */
export function useUpdateTemplate() {
  const [updateMutation, { loading, error }] = useMutation<UpdateTemplateData>(UPDATE_TEMPLATE);

  const update = useCallback(
    async (id: string, input: UpdateTemplateInput) => {
      const result = await updateMutation({
        variables: { id, input },
      });

      return result.data?.updateCommunicationTemplate;
    },
    [updateMutation]
  );

  return {
    update,
    loading,
    error,
  };
}

/**
 * Hook for deleting a template
 */
export function useDeleteTemplate() {
  const [deleteMutation, { loading, error }] = useMutation<DeleteTemplateData>(DELETE_TEMPLATE, {
    refetchQueries: [{ query: GET_TEMPLATES }],
  });

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteMutation({
        variables: { id },
      });

      return result.data?.deleteCommunicationTemplate ?? false;
    },
    [deleteMutation]
  );

  return {
    remove,
    loading,
    error,
  };
}

/**
 * Hook for rendering a template with variables
 */
export function useRenderTemplate() {
  const [renderMutation, { loading, error }] = useMutation<RenderTemplateData>(RENDER_TEMPLATE);

  const render = useCallback(
    async (templateId: string, variables: Record<string, string>) => {
      const result = await renderMutation({
        variables: {
          input: {
            templateId,
            variables,
          },
        },
      });

      return result.data?.renderTemplate;
    },
    [renderMutation]
  );

  return {
    render,
    loading,
    error,
  };
}

/**
 * Utility hook for template categories
 */
export function useTemplateCategories() {
  const categories: { value: TemplateCategory; label: string; description: string }[] = [
    {
      value: 'ClientUpdate',
      label: 'Client Update',
      description: 'Case status updates to clients',
    },
    {
      value: 'CourtFiling',
      label: 'Court Filing',
      description: 'Court filing notifications',
    },
    {
      value: 'AppointmentReminder',
      label: 'Appointment Reminder',
      description: 'Meeting and appointment reminders',
    },
    {
      value: 'DocumentRequest',
      label: 'Document Request',
      description: 'Request for documents',
    },
    {
      value: 'InvoiceReminder',
      label: 'Invoice Reminder',
      description: 'Payment and invoice reminders',
    },
    {
      value: 'CaseOpening',
      label: 'Case Opening',
      description: 'New case welcome messages',
    },
    {
      value: 'CaseClosing',
      label: 'Case Closing',
      description: 'Case conclusion notifications',
    },
    {
      value: 'General',
      label: 'General',
      description: 'General purpose templates',
    },
  ];

  const getCategoryLabel = useCallback((category: TemplateCategory) => {
    return categories.find((c) => c.value === category)?.label || category;
  }, []);

  const getCategoryColor = useCallback((category: TemplateCategory): string => {
    const colors: Record<TemplateCategory, string> = {
      ClientUpdate: 'bg-blue-100 text-blue-700',
      CourtFiling: 'bg-purple-100 text-purple-700',
      AppointmentReminder: 'bg-orange-100 text-orange-700',
      DocumentRequest: 'bg-yellow-100 text-yellow-700',
      InvoiceReminder: 'bg-red-100 text-red-700',
      CaseOpening: 'bg-green-100 text-green-700',
      CaseClosing: 'bg-gray-100 text-gray-700',
      General: 'bg-gray-100 text-gray-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  }, []);

  return {
    categories,
    getCategoryLabel,
    getCategoryColor,
  };
}

/**
 * Extract variables from template body
 */
export function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Preview template with sample data
 */
export function previewTemplate(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}
