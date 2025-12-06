/**
 * Email Draft React Hooks
 * Story 5.3: AI-Powered Email Drafting
 *
 * Provides hooks for generating, refining, and sending AI-powered email drafts
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client/react';
import { useCallback, useState } from 'react';
import { debounce } from 'lodash';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const ATTACHMENT_SUGGESTION_FRAGMENT = gql`
  fragment AttachmentSuggestionFields on AttachmentSuggestion {
    id
    documentId
    title
    reason
    relevanceScore
    isSelected
    document {
      id
      fileName
      fileType
    }
  }
`;

const DRAFT_REFINEMENT_FRAGMENT = gql`
  fragment DraftRefinementFields on DraftRefinement {
    id
    draftId
    instruction
    previousBody
    refinedBody
    tokensUsed
    createdAt
  }
`;

const EMAIL_DRAFT_FRAGMENT = gql`
  ${ATTACHMENT_SUGGESTION_FRAGMENT}
  ${DRAFT_REFINEMENT_FRAGMENT}
  fragment EmailDraftFields on EmailDraft {
    id
    emailId
    caseId
    userId
    tone
    recipientType
    subject
    body
    htmlBody
    confidence
    status
    userEdits
    sentAt
    createdAt
    updatedAt
    email {
      id
      subject
      from {
        name
        address
      }
      toRecipients {
        name
        address
      }
      receivedDateTime
    }
    case {
      id
      title
      caseNumber
    }
    suggestedAttachments {
      ...AttachmentSuggestionFields
    }
    refinements {
      ...DraftRefinementFields
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_EMAIL_DRAFT = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  query GetEmailDraft($id: ID!) {
    emailDraft(id: $id) {
      ...EmailDraftFields
    }
  }
`;

const GET_EMAIL_DRAFTS = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  query GetEmailDrafts($emailId: ID, $caseId: ID, $status: DraftStatus) {
    emailDrafts(emailId: $emailId, caseId: $caseId, status: $status) {
      ...EmailDraftFields
    }
  }
`;

const GET_ATTACHMENT_SUGGESTIONS = gql`
  ${ATTACHMENT_SUGGESTION_FRAGMENT}
  query GetAttachmentSuggestions($draftId: ID!) {
    attachmentSuggestions(draftId: $draftId) {
      ...AttachmentSuggestionFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const GENERATE_EMAIL_DRAFT = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  mutation GenerateEmailDraft($input: GenerateDraftInput!) {
    generateEmailDraft(input: $input) {
      ...EmailDraftFields
    }
  }
`;

const GENERATE_MULTIPLE_DRAFTS = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  mutation GenerateMultipleDrafts($emailId: ID!) {
    generateMultipleDrafts(emailId: $emailId) {
      drafts {
        tone
        draft {
          ...EmailDraftFields
        }
      }
      recommendedTone
      recommendationReason
    }
  }
`;

const REFINE_DRAFT = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  mutation RefineDraft($input: RefineDraftInput!) {
    refineDraft(input: $input) {
      ...EmailDraftFields
    }
  }
`;

const UPDATE_DRAFT = gql`
  ${EMAIL_DRAFT_FRAGMENT}
  mutation UpdateDraft($input: UpdateDraftInput!) {
    updateDraft(input: $input) {
      ...EmailDraftFields
    }
  }
`;

const SEND_DRAFT = gql`
  mutation SendDraft($draftId: ID!) {
    sendDraft(draftId: $draftId)
  }
`;

const DISCARD_DRAFT = gql`
  mutation DiscardDraft($draftId: ID!) {
    discardDraft(draftId: $draftId)
  }
`;

const SELECT_ATTACHMENT = gql`
  ${ATTACHMENT_SUGGESTION_FRAGMENT}
  mutation SelectAttachment($suggestionId: ID!, $selected: Boolean!) {
    selectAttachment(suggestionId: $suggestionId, selected: $selected) {
      ...AttachmentSuggestionFields
    }
  }
`;

const GET_INLINE_SUGGESTION = gql`
  mutation GetInlineSuggestion($input: InlineSuggestionInput!) {
    getInlineSuggestion(input: $input) {
      type
      suggestion
      confidence
      reason
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type EmailTone = 'Formal' | 'Professional' | 'Brief' | 'Detailed';
export type RecipientType = 'Client' | 'OpposingCounsel' | 'Court' | 'ThirdParty' | 'Internal';
export type DraftStatus = 'Generated' | 'Editing' | 'Ready' | 'Sent' | 'Discarded';

export interface EmailDraft {
  id: string;
  emailId: string;
  caseId?: string;
  userId: string;
  tone: EmailTone;
  recipientType: RecipientType;
  subject: string;
  body: string;
  htmlBody?: string;
  confidence: number;
  status: DraftStatus;
  userEdits?: any;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  email?: any;
  case?: any;
  suggestedAttachments: AttachmentSuggestion[];
  refinements: DraftRefinement[];
}

export interface AttachmentSuggestion {
  id: string;
  documentId: string;
  title: string;
  reason: string;
  relevanceScore: number;
  isSelected: boolean;
  document?: any;
}

export interface DraftRefinement {
  id: string;
  draftId: string;
  instruction: string;
  previousBody: string;
  refinedBody: string;
  tokensUsed: number;
  createdAt: string;
}

export interface InlineSuggestion {
  type: 'Completion' | 'Correction' | 'Improvement';
  suggestion: string;
  confidence: number;
  reason?: string;
}

export interface MultipleDraftsResult {
  drafts: Array<{
    tone: EmailTone;
    draft: EmailDraft;
  }>;
  recommendedTone: EmailTone;
  recommendationReason: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for generating a single draft
 */
export function useGenerateDraft(emailId: string, tone?: EmailTone, recipientType?: RecipientType) {
  const [generateDraft, { data, loading, error }] = useMutation(GENERATE_EMAIL_DRAFT, {
    refetchQueries: [{ query: GET_EMAIL_DRAFTS, variables: { emailId } }],
  });

  const generate = useCallback(
    async (overrideTone?: EmailTone, overrideRecipientType?: RecipientType) => {
      const result = await generateDraft({
        variables: {
          input: {
            emailId,
            tone: overrideTone || tone || 'Professional',
            recipientType: overrideRecipientType || recipientType || 'Client',
          },
        },
      });
      return result.data?.generateEmailDraft as EmailDraft | undefined;
    },
    [emailId, tone, recipientType, generateDraft]
  );

  return {
    generate,
    draft: data?.generateEmailDraft as EmailDraft | undefined,
    loading,
    error,
  };
}

/**
 * Hook for generating multiple drafts with different tones
 */
export function useGenerateMultipleDrafts(emailId: string) {
  const [generateDrafts, { data, loading, error }] = useMutation(GENERATE_MULTIPLE_DRAFTS, {
    refetchQueries: [{ query: GET_EMAIL_DRAFTS, variables: { emailId } }],
  });

  const generate = useCallback(async () => {
    const result = await generateDrafts({
      variables: { emailId },
    });
    return result.data?.generateMultipleDrafts as MultipleDraftsResult | undefined;
  }, [emailId, generateDrafts]);

  return {
    generate,
    result: data?.generateMultipleDrafts as MultipleDraftsResult | undefined,
    loading,
    error,
  };
}

/**
 * Hook for refining an existing draft
 */
export function useRefineDraft() {
  const [refineDraft, { data, loading, error }] = useMutation(REFINE_DRAFT);

  const refine = useCallback(
    async (draftId: string, instruction: string) => {
      const result = await refineDraft({
        variables: {
          input: { draftId, instruction },
        },
      });
      return result.data?.refineDraft as EmailDraft | undefined;
    },
    [refineDraft]
  );

  return {
    refine,
    draft: data?.refineDraft as EmailDraft | undefined,
    loading,
    error,
  };
}

/**
 * Hook for updating draft content
 */
export function useUpdateDraft() {
  const [updateDraft, { loading, error }] = useMutation(UPDATE_DRAFT);

  const update = useCallback(
    async (
      draftId: string,
      updates: {
        subject?: string;
        body?: string;
        status?: DraftStatus;
        selectedAttachmentIds?: string[];
      }
    ) => {
      const result = await updateDraft({
        variables: {
          input: { draftId, ...updates },
        },
      });
      return result.data?.updateDraft as EmailDraft | undefined;
    },
    [updateDraft]
  );

  // Debounced auto-save for draft editing
  const debouncedUpdate = useCallback(
    debounce((draftId: string, body: string) => {
      update(draftId, { body, status: 'Editing' });
    }, 5000),
    [update]
  );

  return {
    update,
    autoSave: debouncedUpdate,
    loading,
    error,
  };
}

/**
 * Hook for sending a draft
 */
export function useSendDraft() {
  const [sendDraft, { loading, error }] = useMutation(SEND_DRAFT);

  const send = useCallback(
    async (draftId: string) => {
      const result = await sendDraft({
        variables: { draftId },
      });
      return result.data?.sendDraft as boolean;
    },
    [sendDraft]
  );

  return {
    send,
    loading,
    error,
  };
}

/**
 * Hook for discarding a draft
 */
export function useDiscardDraft() {
  const [discardDraft, { loading, error }] = useMutation(DISCARD_DRAFT);

  const discard = useCallback(
    async (draftId: string) => {
      const result = await discardDraft({
        variables: { draftId },
      });
      return result.data?.discardDraft as boolean;
    },
    [discardDraft]
  );

  return {
    discard,
    loading,
    error,
  };
}

/**
 * Hook for getting a single draft
 */
export function useEmailDraft(id: string) {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_DRAFT, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  return {
    draft: data?.emailDraft as EmailDraft | undefined,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for listing drafts
 */
export function useEmailDrafts(filters?: {
  emailId?: string;
  caseId?: string;
  status?: DraftStatus;
}) {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_DRAFTS, {
    variables: filters || {},
    fetchPolicy: 'cache-and-network',
  });

  return {
    drafts: (data?.emailDrafts || []) as EmailDraft[],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for managing attachment suggestions
 */
export function useAttachmentSuggestions(draftId: string) {
  const { data, loading, error, refetch } = useQuery(GET_ATTACHMENT_SUGGESTIONS, {
    variables: { draftId },
    skip: !draftId,
  });

  const [selectAttachment] = useMutation(SELECT_ATTACHMENT);

  const toggleSelection = useCallback(
    async (suggestionId: string, selected: boolean) => {
      const result = await selectAttachment({
        variables: { suggestionId, selected },
      });
      return result.data?.selectAttachment as AttachmentSuggestion | undefined;
    },
    [selectAttachment]
  );

  return {
    suggestions: (data?.attachmentSuggestions || []) as AttachmentSuggestion[],
    loading,
    error,
    refetch,
    toggleSelection,
  };
}

/**
 * Hook for inline AI suggestions while editing
 */
export function useInlineSuggestions(draftId: string) {
  const [getSuggestion, { loading }] = useMutation(GET_INLINE_SUGGESTION);
  const [suggestion, setSuggestion] = useState<InlineSuggestion | null>(null);

  // Debounced function to get suggestions
  const debouncedGetSuggestion = useCallback(
    debounce(async (partialText: string) => {
      if (partialText.length < 10) {
        setSuggestion(null);
        return;
      }

      try {
        const result = await getSuggestion({
          variables: {
            input: { draftId, partialText },
          },
        });
        setSuggestion(result.data?.getInlineSuggestion || null);
      } catch {
        setSuggestion(null);
      }
    }, 300),
    [draftId, getSuggestion]
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return {
    suggestion,
    getSuggestion: debouncedGetSuggestion,
    clearSuggestion,
    loading,
  };
}

/**
 * Combined hook for complete draft workflow
 */
export function useDraftWorkflow(emailId: string) {
  const { generate, loading: generating } = useGenerateDraft(emailId);
  const { generate: generateMultiple, loading: generatingMultiple } =
    useGenerateMultipleDrafts(emailId);
  const { refine, loading: refining } = useRefineDraft();
  const { update, autoSave, loading: updating } = useUpdateDraft();
  const { send, loading: sending } = useSendDraft();
  const { discard, loading: discarding } = useDiscardDraft();
  const { drafts, refetch } = useEmailDrafts({ emailId });

  const [activeDraft, setActiveDraft] = useState<EmailDraft | null>(null);

  const startDraft = useCallback(
    async (tone?: EmailTone, recipientType?: RecipientType) => {
      const draft = await generate(tone, recipientType);
      if (draft) {
        setActiveDraft(draft);
      }
      return draft;
    },
    [generate]
  );

  const startMultipleDrafts = useCallback(async () => {
    const result = await generateMultiple();
    if (result?.drafts?.length) {
      // Set the recommended draft as active
      const recommended = result.drafts.find(
        (d) => d.tone === result.recommendedTone
      );
      setActiveDraft(recommended?.draft || result.drafts[0].draft);
    }
    return result;
  }, [generateMultiple]);

  const refineDraft = useCallback(
    async (instruction: string) => {
      if (!activeDraft) return;
      const refined = await refine(activeDraft.id, instruction);
      if (refined) {
        setActiveDraft(refined);
      }
      return refined;
    },
    [activeDraft, refine]
  );

  const updateDraft = useCallback(
    async (updates: { subject?: string; body?: string; status?: DraftStatus }) => {
      if (!activeDraft) return;
      const updated = await update(activeDraft.id, updates);
      if (updated) {
        setActiveDraft(updated);
      }
      return updated;
    },
    [activeDraft, update]
  );

  const sendDraft = useCallback(async () => {
    if (!activeDraft) return false;
    const sent = await send(activeDraft.id);
    if (sent) {
      setActiveDraft(null);
      refetch();
    }
    return sent;
  }, [activeDraft, send, refetch]);

  const discardDraft = useCallback(async () => {
    if (!activeDraft) return false;
    const discarded = await discard(activeDraft.id);
    if (discarded) {
      setActiveDraft(null);
      refetch();
    }
    return discarded;
  }, [activeDraft, discard, refetch]);

  const selectDraft = useCallback(
    (draft: EmailDraft) => {
      setActiveDraft(draft);
    },
    []
  );

  return {
    // State
    activeDraft,
    drafts,
    // Actions
    startDraft,
    startMultipleDrafts,
    refineDraft,
    updateDraft,
    autoSave: activeDraft
      ? (body: string) => autoSave(activeDraft.id, body)
      : undefined,
    sendDraft,
    discardDraft,
    selectDraft,
    // Loading states
    loading: generating || generatingMultiple || refining || updating || sending || discarding,
    generating: generating || generatingMultiple,
    refining,
    updating,
    sending,
    discarding,
  };
}
