'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { CREATE_CASE_NOTE, DELETE_CASE_NOTE, GET_CASE_NOTES } from '@/graphql/mutations';

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';

export interface CreateCaseNoteInput {
  caseId: string;
  content: string;
  color?: NoteColor;
}

export interface CaseNote {
  id: string;
  caseId: string;
  content: string;
  color: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateCaseNoteData {
  createCaseNote: CaseNote;
}

interface GetCaseNotesData {
  caseNotes: CaseNote[];
}

export function useCreateCaseNote() {
  const [createCaseNoteMutation, { loading, error }] = useMutation<
    CreateCaseNoteData,
    { input: CreateCaseNoteInput }
  >(CREATE_CASE_NOTE);

  const createCaseNote = async (input: CreateCaseNoteInput) => {
    const result = await createCaseNoteMutation({
      variables: { input },
      refetchQueries: [{ query: GET_CASE_NOTES, variables: { caseId: input.caseId } }],
    });
    return result.data?.createCaseNote;
  };

  return {
    createCaseNote,
    loading,
    error,
  };
}

export function useCaseNotes(caseId: string) {
  const { data, loading, error, refetch } = useQuery<GetCaseNotesData>(GET_CASE_NOTES, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    notes: data?.caseNotes ?? [],
    loading,
    error,
    refetch,
  };
}

export function useDeleteCaseNote() {
  const [deleteCaseNoteMutation, { loading, error }] = useMutation<
    { deleteCaseNote: boolean },
    { id: string }
  >(DELETE_CASE_NOTE);

  const deleteCaseNote = async (id: string, caseId: string) => {
    const result = await deleteCaseNoteMutation({
      variables: { id },
      refetchQueries: [{ query: GET_CASE_NOTES, variables: { caseId } }],
    });
    return result.data?.deleteCaseNote;
  };

  return {
    deleteCaseNote,
    loading,
    error,
  };
}
