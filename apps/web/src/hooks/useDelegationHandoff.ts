/**
 * Delegation Handoff React Hooks
 * Story 4.5: Team Workload Management
 *
 * AC: 4 - Delegation preserves context with automatic handoff notes
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import type {
  DelegationHandoff,
  GenerateHandoffInput,
  GenerateHandoffResponse,
} from '@legal-platform/types';

// GraphQL Operations
const GET_DELEGATION_HANDOFF = gql`
  query GetDelegationHandoff($delegationId: ID!) {
    delegationHandoff(delegationId: $delegationId) {
      id
      delegationId
      handoffNotes
      contextSummary
      relatedTaskIds
      relatedDocIds
      aiGenerated
      createdAt
    }
  }
`;

const GENERATE_HANDOFF = gql`
  mutation GenerateHandoff($input: GenerateHandoffInput!) {
    generateHandoff(input: $input) {
      handoffNotes
      contextSummary
      suggestedDocs
      suggestedTasks
    }
  }
`;

const SAVE_HANDOFF = gql`
  mutation SaveHandoff(
    $delegationId: ID!
    $handoffNotes: String!
    $contextSummary: String
    $relatedTaskIds: [ID!]
    $relatedDocIds: [ID!]
  ) {
    saveHandoff(
      delegationId: $delegationId
      handoffNotes: $handoffNotes
      contextSummary: $contextSummary
      relatedTaskIds: $relatedTaskIds
      relatedDocIds: $relatedDocIds
    ) {
      id
      delegationId
      handoffNotes
      contextSummary
      relatedTaskIds
      relatedDocIds
      aiGenerated
      createdAt
    }
  }
`;

/**
 * Hook to get delegation handoff
 */
export function useDelegationHandoff(delegationId: string) {
  return useQuery<{ delegationHandoff: DelegationHandoff | null }>(GET_DELEGATION_HANDOFF, {
    variables: { delegationId },
    skip: !delegationId,
  });
}

/**
 * Hook to generate AI handoff notes
 */
export function useGenerateHandoff() {
  return useMutation<
    { generateHandoff: GenerateHandoffResponse },
    { input: GenerateHandoffInput }
  >(GENERATE_HANDOFF);
}

/**
 * Hook to save handoff notes
 */
export function useSaveHandoff() {
  return useMutation<
    { saveHandoff: DelegationHandoff },
    {
      delegationId: string;
      handoffNotes: string;
      contextSummary?: string;
      relatedTaskIds?: string[];
      relatedDocIds?: string[];
    }
  >(SAVE_HANDOFF, {
    refetchQueries: ['GetDelegationHandoff'],
  });
}
