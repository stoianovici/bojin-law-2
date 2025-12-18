/**
 * useClassifyEmail Hook
 * OPS-042: Classification Modal (NECLAR Queue)
 *
 * Provides data and mutations for classifying uncertain emails.
 * Used by the ClassificationModal component.
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const UNCERTAIN_EMAIL_FIELDS = gql`
  fragment UncertainEmailFields on UncertainEmail {
    id
    subject
    from {
      name
      address
    }
    receivedDateTime
    bodyPreview
    bodyContent
    suggestedCases {
      id
      caseNumber
      title
      score
      signals {
        type
        weight
        matched
      }
      lastActivityAt
    }
    uncertaintyReason
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_UNCERTAIN_EMAILS = gql`
  ${UNCERTAIN_EMAIL_FIELDS}
  query GetUncertainEmails($limit: Int, $offset: Int) {
    uncertainEmails(limit: $limit, offset: $offset) {
      ...UncertainEmailFields
    }
  }
`;

const GET_UNCERTAIN_EMAILS_COUNT = gql`
  query GetUncertainEmailsCount {
    uncertainEmailsCount
  }
`;

const GET_UNCERTAIN_EMAIL = gql`
  ${UNCERTAIN_EMAIL_FIELDS}
  query GetUncertainEmail($id: ID!) {
    uncertainEmail(id: $id) {
      ...UncertainEmailFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CLASSIFY_UNCERTAIN_EMAIL = gql`
  mutation ClassifyUncertainEmail($emailId: ID!, $action: ClassificationActionInput!) {
    classifyUncertainEmail(emailId: $emailId, action: $action) {
      email {
        id
        classificationState
        caseId
      }
      case {
        id
        title
        caseNumber
      }
      wasIgnored
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface ClassificationSignal {
  type: string;
  weight: number;
  matched: string;
}

export interface SuggestedCase {
  id: string;
  caseNumber: string;
  title: string;
  score: number;
  signals: ClassificationSignal[];
  lastActivityAt: string | null;
}

export interface UncertainEmail {
  id: string;
  subject: string;
  from: { name?: string; address: string };
  receivedDateTime: string;
  bodyPreview: string;
  bodyContent?: string | null;
  suggestedCases: SuggestedCase[];
  uncertaintyReason?: string;
}

interface ClassifyUncertainEmailResult {
  classifyUncertainEmail: {
    email: {
      id: string;
      classificationState: string;
      caseId: string | null;
    };
    case: {
      id: string;
      title: string;
      caseNumber: string;
    } | null;
    wasIgnored: boolean;
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch uncertain emails for the NECLAR queue
 */
export function useUncertainEmails(options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options || {};

  const { data, loading, error, refetch } = useQuery<{ uncertainEmails: UncertainEmail[] }>(
    GET_UNCERTAIN_EMAILS,
    {
      variables: { limit, offset },
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    emails: data?.uncertainEmails || [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch the count of uncertain emails
 */
export function useUncertainEmailsCount() {
  const { data, loading, error, refetch } = useQuery<{ uncertainEmailsCount: number }>(
    GET_UNCERTAIN_EMAILS_COUNT,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    count: data?.uncertainEmailsCount || 0,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch a single uncertain email with full details
 */
export function useUncertainEmail(emailId: string) {
  const { data, loading, error, refetch } = useQuery<{ uncertainEmail: UncertainEmail | null }>(
    GET_UNCERTAIN_EMAIL,
    {
      variables: { id: emailId },
      skip: !emailId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    email: data?.uncertainEmail,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to classify an uncertain email
 */
export function useClassifyUncertainEmail() {
  const [classifyMutation, { loading, error }] = useMutation<ClassifyUncertainEmailResult>(
    CLASSIFY_UNCERTAIN_EMAIL,
    {
      refetchQueries: ['GetUncertainEmails', 'GetUncertainEmailsCount'],
    }
  );

  const classifyToCase = useCallback(
    async (emailId: string, caseId: string) => {
      const result = await classifyMutation({
        variables: {
          emailId,
          action: { type: 'ASSIGN_TO_CASE', caseId },
        },
      });
      return result.data?.classifyUncertainEmail;
    },
    [classifyMutation]
  );

  const markAsIgnored = useCallback(
    async (emailId: string) => {
      const result = await classifyMutation({
        variables: {
          emailId,
          action: { type: 'IGNORE' },
        },
      });
      return result.data?.classifyUncertainEmail;
    },
    [classifyMutation]
  );

  return {
    classifyToCase,
    markAsIgnored,
    loading,
    error,
  };
}

/**
 * Combined hook for the classification modal
 * Provides everything needed to display and interact with the modal
 */
export function useClassificationModal(emailId: string) {
  const { email, loading: loadingEmail, error: emailError, refetch } = useUncertainEmail(emailId);
  const {
    classifyToCase,
    markAsIgnored,
    loading: classifying,
    error: classifyError,
  } = useClassifyUncertainEmail();

  return {
    email,
    loadingEmail,
    emailError,
    classifyToCase,
    markAsIgnored,
    classifying,
    classifyError,
    refetch,
  };
}

export default useClassifyUncertainEmail;
