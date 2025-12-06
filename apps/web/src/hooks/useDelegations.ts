/**
 * Task Delegation React Hooks
 * Story 4.2: Task Type System Implementation - Business Trip Tasks
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// GraphQL Operations
const TASK_DELEGATION_FRAGMENT = gql`
  fragment TaskDelegationFields on TaskDelegation {
    id
    sourceTaskId
    sourceTask {
      id
      title
      type
    }
    delegatedTaskId
    delegatedTask {
      id
      title
    }
    delegatedTo
    delegate {
      id
      firstName
      lastName
      email
    }
    delegatedBy
    delegator {
      id
      firstName
      lastName
      email
    }
    reason
    startDate
    endDate
    status
    notes
    createdAt
    acceptedAt
  }
`;

const GET_MY_DELEGATIONS = gql`
  ${TASK_DELEGATION_FRAGMENT}
  query GetMyDelegations {
    myDelegations {
      ...TaskDelegationFields
    }
  }
`;

const GET_DELEGATIONS_TO_ME = gql`
  ${TASK_DELEGATION_FRAGMENT}
  query GetDelegationsToMe {
    delegationsToMe {
      ...TaskDelegationFields
    }
  }
`;

const CREATE_DELEGATION = gql`
  ${TASK_DELEGATION_FRAGMENT}
  mutation CreateDelegation($sourceTaskId: ID!, $input: CreateDelegationInput!) {
    createDelegation(sourceTaskId: $sourceTaskId, input: $input) {
      ...TaskDelegationFields
    }
  }
`;

const ACCEPT_DELEGATION = gql`
  ${TASK_DELEGATION_FRAGMENT}
  mutation AcceptDelegation($delegationId: ID!) {
    acceptDelegation(delegationId: $delegationId) {
      ...TaskDelegationFields
    }
  }
`;

const DECLINE_DELEGATION = gql`
  ${TASK_DELEGATION_FRAGMENT}
  mutation DeclineDelegation($delegationId: ID!, $reason: String) {
    declineDelegation(delegationId: $delegationId, reason: $reason) {
      ...TaskDelegationFields
    }
  }
`;

// Interfaces
export interface TaskDelegation {
  id: string;
  sourceTaskId: string;
  sourceTask: {
    id: string;
    title: string;
    type: string;
  };
  delegatedTaskId?: string;
  delegatedTask?: {
    id: string;
    title: string;
  };
  delegatedTo: string;
  delegate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  delegatedBy: string;
  delegator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reason: string;
  startDate: Date;
  endDate: Date;
  status: 'Pending' | 'Accepted' | 'Declined';
  notes?: string;
  createdAt: Date;
  acceptedAt?: Date;
}

export interface CreateDelegationInput {
  delegatedTo: string;
  taskIds?: string[];
  startDate: string;
  endDate: string;
  notes?: string;
}

// Custom Hooks

/**
 * Hook to get delegations created by the current user
 */
export function useMyDelegations() {
  return useQuery<{ myDelegations: TaskDelegation[] }>(GET_MY_DELEGATIONS);
}

/**
 * Hook to get delegation requests sent to the current user
 */
export function useDelegationsToMe() {
  return useQuery<{ delegationsToMe: TaskDelegation[] }>(GET_DELEGATIONS_TO_ME);
}

/**
 * Hook to create a new delegation
 */
export function useCreateDelegation() {
  return useMutation<
    { createDelegation: TaskDelegation },
    { sourceTaskId: string; input: CreateDelegationInput }
  >(CREATE_DELEGATION, {
    refetchQueries: ['GetMyDelegations'],
  });
}

/**
 * Hook to accept a delegation
 */
export function useAcceptDelegation() {
  return useMutation<{ acceptDelegation: TaskDelegation }, { delegationId: string }>(
    ACCEPT_DELEGATION,
    {
      refetchQueries: ['GetDelegationsToMe', 'GetMyDelegations'],
    }
  );
}

/**
 * Hook to decline a delegation
 */
export function useDeclineDelegation() {
  return useMutation<
    { declineDelegation: TaskDelegation },
    { delegationId: string; reason?: string }
  >(DECLINE_DELEGATION, {
    refetchQueries: ['GetDelegationsToMe', 'GetMyDelegations'],
  });
}
