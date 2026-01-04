'use client';

import { useState, useCallback } from 'react';
import { useQuery } from './useGraphQL';
import { apolloClient } from '@/lib/apollo-client';
import {
  GET_MAPA,
  GET_MAPAS,
  GET_CASES_WITH_MAPE,
  CREATE_MAPA,
  UPDATE_MAPA,
  DELETE_MAPA,
  ASSIGN_DOCUMENT_TO_SLOT,
  REMOVE_DOCUMENT_FROM_SLOT,
  UPDATE_SLOT_STATUS,
  ADD_SLOT_TO_MAPA,
  REMOVE_SLOT_FROM_MAPA,
  REORDER_SLOTS,
  CREATE_DOCUMENT_REQUEST,
  CANCEL_DOCUMENT_REQUEST,
  MARK_REQUEST_AS_RECEIVED,
} from '@/graphql/mapa';
import type { Mapa, MapaSlot, CaseWithMape, SlotStatus, DocumentRequest } from '@/types/mapa';

// Mutation result types
interface CreateMapaMutationResult {
  createMapa: Mapa;
}

interface UpdateMapaMutationResult {
  updateMapa: Mapa;
}

interface DeleteMapaMutationResult {
  deleteMapa: { success: boolean; message?: string };
}

interface AssignDocumentMutationResult {
  assignDocumentToSlot: MapaSlot;
}

interface RemoveDocumentMutationResult {
  removeDocumentFromSlot: MapaSlot;
}

interface UpdateSlotStatusMutationResult {
  updateSlotStatus: MapaSlot;
}

interface AddSlotMutationResult {
  addSlotToMapa: MapaSlot;
}

interface RemoveSlotMutationResult {
  removeSlotFromMapa: { success: boolean; message?: string };
}

interface ReorderSlotsMutationResult {
  reorderSlots: Array<{ id: string; order: number }>;
}

interface CreateDocumentRequestMutationResult {
  createDocumentRequest: DocumentRequest;
}

interface CancelDocumentRequestMutationResult {
  cancelDocumentRequest: DocumentRequest;
}

interface MarkRequestAsReceivedMutationResult {
  markRequestAsReceived: {
    id: string;
    status: string;
    slot: MapaSlot;
  };
}

// ============================================================================
// Query Hooks
// ============================================================================

interface MapaQueryResult {
  mapa: Mapa;
}

interface MapasQueryResult {
  mapas: Mapa[];
}

interface CasesWithMapeQueryResult {
  casesWithMape: CaseWithMape[];
}

/**
 * Hook to fetch a single mapa by ID
 */
export function useMapa(id: string | undefined) {
  const { data, loading, error, refetch } = useQuery<MapaQueryResult>(GET_MAPA, {
    variables: { id },
    skip: !id,
  });

  return {
    mapa: data?.mapa,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch all mapas for a case
 */
export function useMapas(caseId: string | undefined) {
  const { data, loading, error, refetch } = useQuery<MapasQueryResult>(GET_MAPAS, {
    variables: { caseId },
    skip: !caseId,
  });

  return {
    mapas: data?.mapas ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch all cases with their mape for sidebar display
 */
export function useCasesWithMape() {
  const { data, loading, error, refetch } = useQuery<CasesWithMapeQueryResult>(GET_CASES_WITH_MAPE);

  return {
    cases: data?.casesWithMape ?? [],
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateMapaInput {
  caseId: string;
  name: string;
  description?: string;
}

interface UpdateMapaInput {
  name?: string;
  description?: string;
}

/**
 * Hook to create a new mapa
 * Uses API route instead of GraphQL for development
 */
export function useCreateMapa() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const createMapa = useCallback(async (input: CreateMapaInput): Promise<Mapa | null> => {
    setLoading(true);
    setError(undefined);

    try {
      // Extract only primitive values to avoid circular references
      const payload = {
        caseId: String(input.caseId),
        name: String(input.name),
        description: input.description ? String(input.description) : undefined,
      };

      // Use API route instead of GraphQL
      const response = await fetch('/api/mapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create mapa');
      }

      const data = await response.json();
      return data.mapa ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createMapa, loading, error };
}

/**
 * Hook to update an existing mapa
 */
export function useUpdateMapa() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const updateMapa = useCallback(
    async (id: string, input: UpdateMapaInput): Promise<Mapa | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<UpdateMapaMutationResult>({
          mutation: UPDATE_MAPA,
          variables: { id, input },
        });
        return result.data?.updateMapa ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateMapa, loading, error };
}

/**
 * Hook to delete a mapa
 */
export function useDeleteMapa() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const deleteMapa = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<DeleteMapaMutationResult>({
        mutation: DELETE_MAPA,
        variables: { id },
      });
      return result.data?.deleteMapa?.success ?? false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteMapa, loading, error };
}

// ============================================================================
// Slot Mutation Hooks
// ============================================================================

/**
 * Hook to assign a document to a slot
 */
export function useAssignDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const assignDocument = useCallback(
    async (slotId: string, documentId: string): Promise<MapaSlot | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<AssignDocumentMutationResult>({
          mutation: ASSIGN_DOCUMENT_TO_SLOT,
          variables: { slotId, documentId },
        });
        return result.data?.assignDocumentToSlot ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { assignDocument, loading, error };
}

/**
 * Hook to remove a document from a slot
 */
export function useRemoveDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const removeDocument = useCallback(async (slotId: string): Promise<MapaSlot | null> => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<RemoveDocumentMutationResult>({
        mutation: REMOVE_DOCUMENT_FROM_SLOT,
        variables: { slotId },
      });
      return result.data?.removeDocumentFromSlot ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { removeDocument, loading, error };
}

/**
 * Hook to update slot status
 */
export function useUpdateSlotStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const updateSlotStatus = useCallback(
    async (slotId: string, status: SlotStatus): Promise<MapaSlot | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<UpdateSlotStatusMutationResult>({
          mutation: UPDATE_SLOT_STATUS,
          variables: { slotId, status },
        });
        return result.data?.updateSlotStatus ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateSlotStatus, loading, error };
}

interface AddSlotInput {
  name: string;
  description?: string;
  category: string;
  required: boolean;
  order?: number;
}

/**
 * Hook to add a new slot to a mapa
 */
export function useAddSlot() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const addSlot = useCallback(
    async (mapaId: string, input: AddSlotInput): Promise<MapaSlot | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<AddSlotMutationResult>({
          mutation: ADD_SLOT_TO_MAPA,
          variables: { mapaId, input },
        });
        return result.data?.addSlotToMapa ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { addSlot, loading, error };
}

/**
 * Hook to remove a slot from a mapa
 */
export function useRemoveSlot() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const removeSlot = useCallback(async (slotId: string): Promise<boolean> => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<RemoveSlotMutationResult>({
        mutation: REMOVE_SLOT_FROM_MAPA,
        variables: { slotId },
      });
      return result.data?.removeSlotFromMapa?.success ?? false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { removeSlot, loading, error };
}

/**
 * Hook to reorder slots within a mapa
 */
export function useReorderSlots() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const reorderSlots = useCallback(async (mapaId: string, slotIds: string[]): Promise<boolean> => {
    setLoading(true);
    setError(undefined);

    try {
      await apolloClient.mutate<ReorderSlotsMutationResult>({
        mutation: REORDER_SLOTS,
        variables: { mapaId, slotIds },
      });
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reorderSlots, loading, error };
}

// ============================================================================
// Document Request Hooks
// ============================================================================

interface CreateDocumentRequestInput {
  slotId: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  dueDate: string;
}

/**
 * Hook to create a document request (send email to request document)
 */
export function useCreateDocumentRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const createRequest = useCallback(async (input: CreateDocumentRequestInput) => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<CreateDocumentRequestMutationResult>({
        mutation: CREATE_DOCUMENT_REQUEST,
        variables: { input },
      });
      return result.data?.createDocumentRequest ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createRequest, loading, error };
}

/**
 * Hook to cancel a pending document request
 */
export function useCancelDocumentRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const cancelRequest = useCallback(async (requestId: string) => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<CancelDocumentRequestMutationResult>({
        mutation: CANCEL_DOCUMENT_REQUEST,
        variables: { requestId },
      });
      return result.data?.cancelDocumentRequest ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { cancelRequest, loading, error };
}

/**
 * Hook to mark a document request as received
 */
export function useMarkRequestAsReceived() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const markAsReceived = useCallback(async (requestId: string, documentId: string) => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await apolloClient.mutate<MarkRequestAsReceivedMutationResult>({
        mutation: MARK_REQUEST_AS_RECEIVED,
        variables: { requestId, documentId },
      });
      return result.data?.markRequestAsReceived ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { markAsReceived, loading, error };
}
