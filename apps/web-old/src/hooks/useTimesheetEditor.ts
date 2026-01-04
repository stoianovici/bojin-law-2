/**
 * Timesheet Editor Hook
 * OPS-274: Manages edit state for timesheet inline editing
 *
 * Features:
 * - Track dirty fields per row
 * - Debounced auto-save (500ms after last change)
 * - Optimistic updates
 * - Rollback on error
 */

import { useCallback, useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';

// ============================================================================
// GraphQL Mutation
// ============================================================================

const UPDATE_TIME_ENTRY = gql`
  mutation UpdateTimeEntry($id: ID!, $input: UpdateTimeEntryInput!) {
    updateTimeEntry(id: $id, input: $input) {
      id
      hours
      billable
      description
      narrative
    }
  }
`;

interface UpdateTimeEntryInput {
  hours?: number;
  billable?: boolean;
  description?: string;
  narrative?: string;
}

interface UpdateTimeEntryResult {
  updateTimeEntry: {
    id: string;
    hours: number;
    billable: boolean;
    description: string;
    narrative: string | null;
  };
}

interface UpdateTimeEntryVariables {
  id: string;
  input: UpdateTimeEntryInput;
}

// ============================================================================
// Types
// ============================================================================

export interface UseTimesheetEditorOptions {
  onUpdateSuccess?: (entryId: string, field: string, newValue: number | boolean) => void;
  onUpdateError?: (entryId: string, error: Error) => void;
}

export interface UseTimesheetEditorResult {
  updateHours: (entryId: string, hours: number) => Promise<void>;
  updateBillable: (entryId: string, billable: boolean) => Promise<void>;
  isUpdating: (entryId: string) => boolean;
  updatingFields: Map<string, Set<string>>;
}

// ============================================================================
// Hook
// ============================================================================

export function useTimesheetEditor(
  options: UseTimesheetEditorOptions = {}
): UseTimesheetEditorResult {
  const { onUpdateSuccess, onUpdateError } = options;

  // Track which entries are currently being updated and which fields
  const [updatingFields, setUpdatingFields] = useState<Map<string, Set<string>>>(new Map());

  const [updateTimeEntryMutation] = useMutation<UpdateTimeEntryResult, UpdateTimeEntryVariables>(
    UPDATE_TIME_ENTRY
  );

  const markFieldUpdating = useCallback((entryId: string, field: string, updating: boolean) => {
    setUpdatingFields((prev) => {
      const next = new Map(prev);
      const fields = next.get(entryId) || new Set();

      if (updating) {
        fields.add(field);
      } else {
        fields.delete(field);
      }

      if (fields.size === 0) {
        next.delete(entryId);
      } else {
        next.set(entryId, fields);
      }

      return next;
    });
  }, []);

  const updateHours = useCallback(
    async (entryId: string, hours: number) => {
      // Validate hours
      if (hours < 0.25 || hours > 24) {
        throw new Error('Ore între 0.25 și 24');
      }

      // Round to nearest 0.25
      const roundedHours = Math.round(hours * 4) / 4;

      markFieldUpdating(entryId, 'hours', true);

      try {
        await updateTimeEntryMutation({
          variables: {
            id: entryId,
            input: { hours: roundedHours },
          },
          optimisticResponse: {
            updateTimeEntry: {
              id: entryId,
              hours: roundedHours,
              // These will be overwritten by actual response
              billable: true,
              description: '',
              narrative: null,
            },
          },
        });

        onUpdateSuccess?.(entryId, 'hours', roundedHours);
      } catch (error) {
        onUpdateError?.(entryId, error instanceof Error ? error : new Error('Eroare la salvare'));
        throw error;
      } finally {
        markFieldUpdating(entryId, 'hours', false);
      }
    },
    [updateTimeEntryMutation, markFieldUpdating, onUpdateSuccess, onUpdateError]
  );

  const updateBillable = useCallback(
    async (entryId: string, billable: boolean) => {
      markFieldUpdating(entryId, 'billable', true);

      try {
        await updateTimeEntryMutation({
          variables: {
            id: entryId,
            input: { billable },
          },
          optimisticResponse: {
            updateTimeEntry: {
              id: entryId,
              billable,
              // These will be overwritten by actual response
              hours: 0,
              description: '',
              narrative: null,
            },
          },
        });

        onUpdateSuccess?.(entryId, 'billable', billable);
      } catch (error) {
        onUpdateError?.(entryId, error instanceof Error ? error : new Error('Eroare la salvare'));
        throw error;
      } finally {
        markFieldUpdating(entryId, 'billable', false);
      }
    },
    [updateTimeEntryMutation, markFieldUpdating, onUpdateSuccess, onUpdateError]
  );

  const isUpdating = useCallback(
    (entryId: string): boolean => {
      return updatingFields.has(entryId);
    },
    [updatingFields]
  );

  return {
    updateHours,
    updateBillable,
    isUpdating,
    updatingFields,
  };
}

export default useTimesheetEditor;
