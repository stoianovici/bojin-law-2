/**
 * Single Case Query Hook
 * Story 2.8: Case CRUD Operations UI - Task 10
 * Story 2.8.1: Billing & Rate Management - Task 12
 * Story 2.8.2: Case Approval Workflow - Task 14
 *
 * Fetches a single case by ID with all related data including billing and approval information
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { Case, CaseActor, Client } from '@legal-platform/types';

// GraphQL query for fetching a single case
const GET_CASE = gql`
  query GetCase($id: UUID!) {
    case(id: $id) {
      id
      firmId
      caseNumber
      title
      status
      type
      description
      openedDate
      closedDate
      value
      metadata
      createdAt
      updatedAt
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      client {
        id
        name
        contactInfo
        address
      }
      teamMembers {
        id
        userId
        role
        user {
          id
          firstName
          lastName
          email
        }
      }
      actors {
        id
        caseId
        role
        name
        organization
        email
        phone
        address
        notes
        createdAt
        updatedAt
      }
      approval {
        id
        submittedAt
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
    }
  }
`;

interface CaseTeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CaseWithFullRelations extends Case {
  client: Client;
  teamMembers: CaseTeamMember[];
  actors: CaseActor[];
}

interface UseCaseVariables {
  id: string;
}

interface UseCaseResult {
  case: CaseWithFullRelations | null;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch a single case with all related data
 * @param id - Case ID (UUID)
 * @returns Case data, loading state, error, and refetch function
 */
export function useCase(id: string): UseCaseResult {
  const { data, loading, error, refetch } = useQuery<
    { case: CaseWithFullRelations },
    UseCaseVariables
  >(GET_CASE, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
    skip: !id, // Skip query if no ID provided
  });

  return {
    case: data?.case || null,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
