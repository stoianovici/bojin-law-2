/**
 * Mapa (Document Binder) Hooks
 * OPS-102: Mapa UI Components
 *
 * Provides GraphQL operations for mape, slots, and templates
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const MAPA_SLOT_FRAGMENT = gql`
  fragment MapaSlotFields on MapaSlot {
    id
    name
    description
    category
    required
    order
    assignedAt
    document {
      document {
        id
        fileName
        fileType
        fileSize
        storagePath
        oneDriveId
        status
      }
      linkedAt
    }
    assignedBy {
      id
      firstName
      lastName
    }
    createdAt
    updatedAt
  }
`;

const MAPA_FRAGMENT = gql`
  ${MAPA_SLOT_FRAGMENT}
  fragment MapaFields on Mapa {
    id
    name
    description
    slots {
      ...MapaSlotFields
    }
    completionStatus {
      totalSlots
      filledSlots
      requiredSlots
      filledRequiredSlots
      isComplete
      missingRequired
      percentComplete
    }
    template {
      id
      name
    }
    createdAt
    updatedAt
    createdBy {
      id
      firstName
      lastName
    }
  }
`;

const MAPA_TEMPLATE_FRAGMENT = gql`
  fragment MapaTemplateFields on MapaTemplate {
    id
    name
    description
    caseType
    slotDefinitions {
      name
      description
      category
      required
      order
    }
    isActive
    usageCount
    createdAt
    createdBy {
      id
      firstName
      lastName
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_MAPA = gql`
  ${MAPA_FRAGMENT}
  query GetMapa($id: UUID!) {
    mapa(id: $id) {
      ...MapaFields
    }
  }
`;

const GET_CASE_MAPE = gql`
  ${MAPA_FRAGMENT}
  query GetCaseMape($caseId: UUID!) {
    caseMape(caseId: $caseId) {
      ...MapaFields
    }
  }
`;

const GET_MAPA_TEMPLATES = gql`
  ${MAPA_TEMPLATE_FRAGMENT}
  query GetMapaTemplates {
    mapaTemplates {
      ...MapaTemplateFields
    }
  }
`;

const GET_MAPA_TEMPLATE = gql`
  ${MAPA_TEMPLATE_FRAGMENT}
  query GetMapaTemplate($id: UUID!) {
    mapaTemplate(id: $id) {
      ...MapaTemplateFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CREATE_MAPA = gql`
  ${MAPA_FRAGMENT}
  mutation CreateMapa($input: CreateMapaInput!) {
    createMapa(input: $input) {
      ...MapaFields
    }
  }
`;

const CREATE_MAPA_FROM_TEMPLATE = gql`
  ${MAPA_FRAGMENT}
  mutation CreateMapaFromTemplate($templateId: UUID!, $caseId: UUID!) {
    createMapaFromTemplate(templateId: $templateId, caseId: $caseId) {
      ...MapaFields
    }
  }
`;

const CREATE_MAPA_WITH_SLOTS = gql`
  ${MAPA_FRAGMENT}
  mutation CreateMapaWithSlots($input: CreateMapaWithSlotsInput!) {
    createMapaWithSlots(input: $input) {
      ...MapaFields
    }
  }
`;

const UPDATE_MAPA = gql`
  ${MAPA_FRAGMENT}
  mutation UpdateMapa($id: UUID!, $input: UpdateMapaInput!) {
    updateMapa(id: $id, input: $input) {
      ...MapaFields
    }
  }
`;

const DELETE_MAPA = gql`
  mutation DeleteMapa($id: UUID!) {
    deleteMapa(id: $id)
  }
`;

const ADD_MAPA_SLOT = gql`
  ${MAPA_SLOT_FRAGMENT}
  mutation AddMapaSlot($mapaId: UUID!, $input: CreateSlotInput!) {
    addMapaSlot(mapaId: $mapaId, input: $input) {
      ...MapaSlotFields
    }
  }
`;

const UPDATE_MAPA_SLOT = gql`
  ${MAPA_SLOT_FRAGMENT}
  mutation UpdateMapaSlot($slotId: UUID!, $input: UpdateSlotInput!) {
    updateMapaSlot(slotId: $slotId, input: $input) {
      ...MapaSlotFields
    }
  }
`;

const DELETE_MAPA_SLOT = gql`
  mutation DeleteMapaSlot($slotId: UUID!) {
    deleteMapaSlot(slotId: $slotId)
  }
`;

const REORDER_MAPA_SLOTS = gql`
  ${MAPA_SLOT_FRAGMENT}
  mutation ReorderMapaSlots($input: ReorderSlotsInput!) {
    reorderMapaSlots(input: $input) {
      ...MapaSlotFields
    }
  }
`;

const ASSIGN_DOCUMENT_TO_SLOT = gql`
  ${MAPA_SLOT_FRAGMENT}
  mutation AssignDocumentToSlot($slotId: UUID!, $caseDocumentId: UUID!) {
    assignDocumentToSlot(slotId: $slotId, caseDocumentId: $caseDocumentId) {
      ...MapaSlotFields
    }
  }
`;

const UNASSIGN_DOCUMENT_FROM_SLOT = gql`
  ${MAPA_SLOT_FRAGMENT}
  mutation UnassignDocumentFromSlot($slotId: UUID!) {
    unassignDocumentFromSlot(slotId: $slotId) {
      ...MapaSlotFields
    }
  }
`;

const CREATE_MAPA_TEMPLATE = gql`
  ${MAPA_TEMPLATE_FRAGMENT}
  mutation CreateMapaTemplate($input: CreateTemplateInput!) {
    createMapaTemplate(input: $input) {
      ...MapaTemplateFields
    }
  }
`;

const UPDATE_MAPA_TEMPLATE = gql`
  ${MAPA_TEMPLATE_FRAGMENT}
  mutation UpdateMapaTemplate($id: UUID!, $input: UpdateTemplateInput!) {
    updateMapaTemplate(id: $id, input: $input) {
      ...MapaTemplateFields
    }
  }
`;

const DELETE_MAPA_TEMPLATE = gql`
  mutation DeleteMapaTemplate($id: UUID!) {
    deleteMapaTemplate(id: $id)
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface MapaUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface MapaDocument {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    oneDriveId: string | null;
    status: 'DRAFT' | 'FINAL' | 'ARCHIVED';
  };
  linkedAt: string;
}

export interface MapaSlot {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  required: boolean;
  order: number;
  assignedAt: string | null;
  document: MapaDocument | null;
  assignedBy: MapaUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapaCompletionStatus {
  totalSlots: number;
  filledSlots: number;
  requiredSlots: number;
  filledRequiredSlots: number;
  isComplete: boolean;
  missingRequired: string[];
  percentComplete: number;
}

export interface MapaTemplate {
  id: string;
  name: string;
}

export interface Mapa {
  id: string;
  name: string;
  description: string | null;
  slots: MapaSlot[];
  completionStatus: MapaCompletionStatus;
  template: MapaTemplate | null;
  createdAt: string;
  updatedAt: string;
  createdBy: MapaUser;
}

export interface SlotDefinition {
  name: string;
  description: string | null;
  category: string | null;
  required: boolean;
  order: number;
}

export interface MapaTemplateDetail {
  id: string;
  name: string;
  description: string | null;
  caseType: string | null;
  slotDefinitions: SlotDefinition[];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  createdBy: MapaUser;
}

export interface CreateMapaInput {
  caseId: string;
  name: string;
  description?: string;
  templateId?: string;
}

export interface UpdateMapaInput {
  name?: string;
  description?: string;
}

export interface CreateSlotInput {
  name: string;
  description?: string;
  category?: string;
  required?: boolean;
  order: number;
}

export interface UpdateSlotInput {
  name?: string;
  description?: string;
  category?: string;
  required?: boolean;
  order?: number;
}

export interface QuickSlotInput {
  name: string;
  required?: boolean;
}

export interface CreateMapaWithSlotsInput {
  caseId: string;
  name: string;
  description?: string;
  slots: QuickSlotInput[];
}

// ============================================================================
// Mutation Result Types
// ============================================================================

interface UpdateMapaResult {
  updateMapa: Mapa;
}

interface AddMapaSlotResult {
  addMapaSlot: MapaSlot;
}

interface UpdateMapaSlotResult {
  updateMapaSlot: MapaSlot;
}

interface ReorderMapaSlotsResult {
  reorderMapaSlots: MapaSlot[];
}

interface AssignDocumentToSlotResult {
  assignDocumentToSlot: MapaSlot;
}

interface UnassignDocumentFromSlotResult {
  unassignDocumentFromSlot: MapaSlot;
}

interface CreateMapaResult {
  createMapa: Mapa;
}

interface CreateMapaFromTemplateResult {
  createMapaFromTemplate: Mapa;
}

interface CreateMapaWithSlotsResult {
  createMapaWithSlots: Mapa;
}

interface CreateMapaTemplateResult {
  createMapaTemplate: MapaTemplateDetail;
}

interface UpdateMapaTemplateResult {
  updateMapaTemplate: MapaTemplateDetail;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch and manage a single mapa
 */
export function useMapa(mapaId?: string) {
  const { data, loading, error, refetch } = useQuery<{ mapa: Mapa | null }>(GET_MAPA, {
    variables: { id: mapaId },
    skip: !mapaId,
    fetchPolicy: 'cache-and-network',
  });

  const [updateMapaMutation, { loading: updating }] = useMutation<UpdateMapaResult>(UPDATE_MAPA);
  const [deleteMapaMutation, { loading: deleting }] = useMutation(DELETE_MAPA);

  // Slot mutations
  const [addSlotMutation] = useMutation<AddMapaSlotResult>(ADD_MAPA_SLOT);
  const [updateSlotMutation] = useMutation<UpdateMapaSlotResult>(UPDATE_MAPA_SLOT);
  const [deleteSlotMutation] = useMutation(DELETE_MAPA_SLOT);
  const [reorderSlotsMutation] = useMutation<ReorderMapaSlotsResult>(REORDER_MAPA_SLOTS);
  const [assignDocumentMutation] = useMutation<AssignDocumentToSlotResult>(ASSIGN_DOCUMENT_TO_SLOT);
  const [unassignDocumentMutation] = useMutation<UnassignDocumentFromSlotResult>(
    UNASSIGN_DOCUMENT_FROM_SLOT
  );

  const updateMapa = useCallback(
    async (input: UpdateMapaInput) => {
      if (!mapaId) throw new Error('Mapa ID required');
      const result = await updateMapaMutation({
        variables: { id: mapaId, input },
      });
      return result.data?.updateMapa;
    },
    [mapaId, updateMapaMutation]
  );

  const deleteMapa = useCallback(async () => {
    if (!mapaId) throw new Error('Mapa ID required');
    await deleteMapaMutation({
      variables: { id: mapaId },
    });
  }, [mapaId, deleteMapaMutation]);

  const addSlot = useCallback(
    async (input: CreateSlotInput) => {
      if (!mapaId) throw new Error('Mapa ID required');
      const result = await addSlotMutation({
        variables: { mapaId, input },
        refetchQueries: [{ query: GET_MAPA, variables: { id: mapaId } }],
      });
      return result.data?.addMapaSlot;
    },
    [mapaId, addSlotMutation]
  );

  const updateSlot = useCallback(
    async (slotId: string, input: UpdateSlotInput) => {
      const result = await updateSlotMutation({
        variables: { slotId, input },
        refetchQueries: mapaId ? [{ query: GET_MAPA, variables: { id: mapaId } }] : [],
      });
      return result.data?.updateMapaSlot;
    },
    [mapaId, updateSlotMutation]
  );

  const deleteSlot = useCallback(
    async (slotId: string) => {
      await deleteSlotMutation({
        variables: { slotId },
        refetchQueries: mapaId ? [{ query: GET_MAPA, variables: { id: mapaId } }] : [],
      });
    },
    [mapaId, deleteSlotMutation]
  );

  const reorderSlots = useCallback(
    async (slotIds: string[]) => {
      if (!mapaId) throw new Error('Mapa ID required');
      const result = await reorderSlotsMutation({
        variables: { input: { mapaId, slotIds } },
      });
      return result.data?.reorderMapaSlots;
    },
    [mapaId, reorderSlotsMutation]
  );

  const assignDocument = useCallback(
    async (slotId: string, caseDocumentId: string) => {
      const result = await assignDocumentMutation({
        variables: { slotId, caseDocumentId },
        refetchQueries: mapaId ? [{ query: GET_MAPA, variables: { id: mapaId } }] : [],
      });
      return result.data?.assignDocumentToSlot;
    },
    [mapaId, assignDocumentMutation]
  );

  const unassignDocument = useCallback(
    async (slotId: string) => {
      const result = await unassignDocumentMutation({
        variables: { slotId },
        refetchQueries: mapaId ? [{ query: GET_MAPA, variables: { id: mapaId } }] : [],
      });
      return result.data?.unassignDocumentFromSlot;
    },
    [mapaId, unassignDocumentMutation]
  );

  return {
    mapa: data?.mapa ?? null,
    loading,
    error,
    updating,
    deleting,
    refetch,
    updateMapa,
    deleteMapa,
    addSlot,
    updateSlot,
    deleteSlot,
    reorderSlots,
    assignDocument,
    unassignDocument,
  };
}

/**
 * Hook to fetch all mape for a case
 */
export function useCaseMape(caseId: string) {
  const { data, loading, error, refetch } = useQuery<{ caseMape: Mapa[] }>(GET_CASE_MAPE, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  const [createMapaMutation, { loading: creating }] = useMutation<CreateMapaResult>(CREATE_MAPA);
  const [createFromTemplateMutation] =
    useMutation<CreateMapaFromTemplateResult>(CREATE_MAPA_FROM_TEMPLATE);
  const [createWithSlotsMutation] = useMutation<CreateMapaWithSlotsResult>(CREATE_MAPA_WITH_SLOTS);

  const createMapa = useCallback(
    async (input: CreateMapaInput) => {
      const result = await createMapaMutation({
        variables: { input },
        refetchQueries: [{ query: GET_CASE_MAPE, variables: { caseId } }],
      });
      return result.data?.createMapa;
    },
    [caseId, createMapaMutation]
  );

  const createFromTemplate = useCallback(
    async (templateId: string) => {
      const result = await createFromTemplateMutation({
        variables: { templateId, caseId },
        refetchQueries: [{ query: GET_CASE_MAPE, variables: { caseId } }],
      });
      return result.data?.createMapaFromTemplate;
    },
    [caseId, createFromTemplateMutation]
  );

  const createMapaWithSlots = useCallback(
    async (input: Omit<CreateMapaWithSlotsInput, 'caseId'>) => {
      const result = await createWithSlotsMutation({
        variables: { input: { ...input, caseId } },
        refetchQueries: [{ query: GET_CASE_MAPE, variables: { caseId } }],
      });
      return result.data?.createMapaWithSlots;
    },
    [caseId, createWithSlotsMutation]
  );

  return {
    mape: data?.caseMape ?? [],
    loading,
    error,
    creating,
    refetch,
    createMapa,
    createFromTemplate,
    createMapaWithSlots,
  };
}

/**
 * Hook to fetch mapa templates
 */
export function useMapaTemplates() {
  const { data, loading, error, refetch } = useQuery<{ mapaTemplates: MapaTemplateDetail[] }>(
    GET_MAPA_TEMPLATES,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const [createTemplateMutation, { loading: creating }] =
    useMutation<CreateMapaTemplateResult>(CREATE_MAPA_TEMPLATE);
  const [updateTemplateMutation, { loading: updating }] =
    useMutation<UpdateMapaTemplateResult>(UPDATE_MAPA_TEMPLATE);
  const [deleteTemplateMutation, { loading: deleting }] = useMutation(DELETE_MAPA_TEMPLATE);

  const createTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      caseType?: string;
      slotDefinitions: SlotDefinition[];
    }) => {
      const result = await createTemplateMutation({
        variables: { input },
        refetchQueries: [{ query: GET_MAPA_TEMPLATES }],
      });
      return result.data?.createMapaTemplate;
    },
    [createTemplateMutation]
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      input: {
        name?: string;
        description?: string;
        caseType?: string;
        slotDefinitions?: SlotDefinition[];
        isActive?: boolean;
      }
    ) => {
      const result = await updateTemplateMutation({
        variables: { id, input },
        refetchQueries: [{ query: GET_MAPA_TEMPLATES }],
      });
      return result.data?.updateMapaTemplate;
    },
    [updateTemplateMutation]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await deleteTemplateMutation({
        variables: { id },
        refetchQueries: [{ query: GET_MAPA_TEMPLATES }],
      });
    },
    [deleteTemplateMutation]
  );

  return {
    templates: data?.mapaTemplates ?? [],
    loading,
    error,
    creating,
    updating,
    deleting,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

/**
 * Hook to fetch a single mapa template
 */
export function useMapaTemplate(templateId?: string) {
  const { data, loading, error, refetch } = useQuery<{ mapaTemplate: MapaTemplateDetail | null }>(
    GET_MAPA_TEMPLATE,
    {
      variables: { id: templateId },
      skip: !templateId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    template: data?.mapaTemplate ?? null,
    loading,
    error,
    refetch,
  };
}
