'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_TIME_ENTRY } from '@/graphql/mutations';

// ============================================
// Types
// ============================================

export interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  date: string;
  case: {
    id: string;
    caseNumber: string;
  } | null;
}

export interface CreateTimeEntryInput {
  caseId: string;
  description: string;
  hours: number;
  date: string;
}

// ============================================
// Hook
// ============================================

export function useTimeEntry() {
  const [createTimeEntry, { loading: creating, error }] = useMutation<
    { createTimeEntry: TimeEntry },
    { input: CreateTimeEntryInput }
  >(CREATE_TIME_ENTRY);

  const create = async (input: CreateTimeEntryInput) => {
    const result = await createTimeEntry({
      variables: { input },
    });
    return result.data?.createTimeEntry;
  };

  return {
    create,
    creating,
    error,
  };
}
