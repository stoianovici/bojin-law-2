/**
 * Assignment Suggestions React Hook
 * Story 4.5: Team Workload Management
 *
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 */

import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import type {
  AssignmentSuggestionResponse,
  SkillType,
} from '@legal-platform/types';

// GraphQL Operations
const GET_ASSIGNMENT_SUGGESTIONS = gql`
  query GetAssignmentSuggestions($input: AssignmentSuggestionInput!) {
    suggestAssignees(input: $input) {
      suggestions {
        userId
        user {
          id
          firstName
          lastName
          role
        }
        matchScore
        skillMatch
        capacityMatch
        currentWorkload
        availableCapacity
        reasoning
        caveats
      }
      noSuitableCandidates
      allOverloaded
      recommendedAssignee
    }
  }
`;

export interface AssignmentSuggestionInput {
  taskType: string;
  taskTitle: string;
  caseId: string;
  estimatedHours: number;
  dueDate: string; // ISO date
  requiredSkills?: SkillType[];
  excludeUserIds?: string[];
}

/**
 * Hook to get assignment suggestions for a task
 * Uses lazy query since suggestions are requested on demand
 */
export function useAssignmentSuggestions() {
  const [getSuggestions, { data, loading, error }] = useLazyQuery<{
    suggestAssignees: AssignmentSuggestionResponse;
  }>(GET_ASSIGNMENT_SUGGESTIONS, {
    fetchPolicy: 'network-only', // Always fetch fresh suggestions
  });

  const fetchSuggestions = async (input: AssignmentSuggestionInput) => {
    return getSuggestions({ variables: { input } });
  };

  return {
    fetchSuggestions,
    suggestions: data?.suggestAssignees ?? null,
    isLoading: loading,
    error,
  };
}
