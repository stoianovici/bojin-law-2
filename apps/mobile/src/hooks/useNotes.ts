'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_NOTE } from '@/graphql/mutations';

// ============================================
// Types
// ============================================

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  case: {
    id: string;
    caseNumber: string;
  } | null;
}

export interface CreateNoteInput {
  caseId: string;
  content: string;
}

// ============================================
// Hook
// ============================================

export function useNotes() {
  const [createNote, { loading: creating, error }] = useMutation<
    { createNote: Note },
    { input: CreateNoteInput }
  >(CREATE_NOTE);

  const create = async (input: CreateNoteInput) => {
    const result = await createNote({
      variables: { input },
    });
    return result.data?.createNote;
  };

  return {
    create,
    creating,
    error,
  };
}
