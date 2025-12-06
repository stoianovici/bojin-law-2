/**
 * Case Subscription React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 6)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// Types
interface CaseSubscription {
  id: string;
  caseId: string;
  userId: string;
  digestEnabled: boolean;
  notifyOnTask: boolean;
  notifyOnDocument: boolean;
  notifyOnComment: boolean;
  createdAt: string;
  updatedAt: string;
}

// GraphQL Fragments
const SUBSCRIPTION_FRAGMENT = gql`
  fragment SubscriptionFields on CaseSubscription {
    id
    caseId
    userId
    digestEnabled
    notifyOnTask
    notifyOnDocument
    notifyOnComment
    createdAt
    updatedAt
  }
`;

// Queries
const GET_CASE_SUBSCRIPTION = gql`
  ${SUBSCRIPTION_FRAGMENT}
  query GetCaseSubscription($caseId: ID!) {
    caseSubscription(caseId: $caseId) {
      ...SubscriptionFields
    }
  }
`;

const GET_MY_SUBSCRIPTIONS = gql`
  ${SUBSCRIPTION_FRAGMENT}
  query GetMySubscriptions {
    mySubscriptions {
      ...SubscriptionFields
    }
  }
`;

// Mutations
const SUBSCRIBE_TO_CASE = gql`
  ${SUBSCRIPTION_FRAGMENT}
  mutation SubscribeToCaseUpdates($caseId: ID!, $input: UpdateSubscriptionInput) {
    subscribeToCaseUpdates(caseId: $caseId, input: $input) {
      ...SubscriptionFields
    }
  }
`;

const UPDATE_SUBSCRIPTION = gql`
  ${SUBSCRIPTION_FRAGMENT}
  mutation UpdateCaseSubscription($caseId: ID!, $input: UpdateSubscriptionInput!) {
    updateCaseSubscription(caseId: $caseId, input: $input) {
      ...SubscriptionFields
    }
  }
`;

const UNSUBSCRIBE_FROM_CASE = gql`
  mutation UnsubscribeFromCaseUpdates($caseId: ID!) {
    unsubscribeFromCaseUpdates(caseId: $caseId)
  }
`;

// Input interfaces
export interface UpdateSubscriptionInput {
  digestEnabled?: boolean;
  notifyOnTask?: boolean;
  notifyOnDocument?: boolean;
  notifyOnComment?: boolean;
}

// Custom Hooks

/**
 * Hook to get subscription status for a case
 */
export function useCaseSubscription(caseId: string) {
  return useQuery<{ caseSubscription: CaseSubscription | null }>(GET_CASE_SUBSCRIPTION, {
    variables: { caseId },
    skip: !caseId,
  });
}

/**
 * Hook to get all subscriptions for current user
 */
export function useMySubscriptions() {
  return useQuery<{ mySubscriptions: CaseSubscription[] }>(GET_MY_SUBSCRIPTIONS);
}

/**
 * Hook to subscribe to case updates
 */
export function useSubscribeToCaseUpdates() {
  return useMutation<
    { subscribeToCaseUpdates: CaseSubscription },
    { caseId: string; input?: UpdateSubscriptionInput }
  >(SUBSCRIBE_TO_CASE, {
    refetchQueries: ['GetCaseSubscription', 'GetMySubscriptions'],
  });
}

/**
 * Hook to update subscription preferences
 */
export function useUpdateCaseSubscription() {
  return useMutation<
    { updateCaseSubscription: CaseSubscription },
    { caseId: string; input: UpdateSubscriptionInput }
  >(UPDATE_SUBSCRIPTION, {
    refetchQueries: ['GetCaseSubscription'],
  });
}

/**
 * Hook to unsubscribe from case updates
 */
export function useUnsubscribeFromCaseUpdates() {
  return useMutation<{ unsubscribeFromCaseUpdates: boolean }, { caseId: string }>(
    UNSUBSCRIBE_FROM_CASE,
    {
      refetchQueries: ['GetCaseSubscription', 'GetMySubscriptions'],
    }
  );
}

export type { CaseSubscription };
