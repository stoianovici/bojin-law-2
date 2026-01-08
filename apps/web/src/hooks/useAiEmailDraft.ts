'use client';

import { useState, useCallback } from 'react';
import { apolloClient } from '@/lib/apollo-client';
import { GENERATE_AI_REPLY, GENERATE_QUICK_REPLY } from '@/graphql/queries';
import type { AiDraftResponse, EmailTone } from '@/types/email';

interface UseAiEmailDraftResult {
  // Quick reply (for confirmations, polite responses)
  generateQuickReply: (threadId: string) => Promise<AiDraftResponse | null>;

  // Prompt-based detailed reply
  generateFromPrompt: (
    threadId: string,
    prompt: string,
    tone?: EmailTone
  ) => Promise<AiDraftResponse | null>;

  // State
  draft: AiDraftResponse | null;
  loading: boolean;
  error: Error | undefined;

  // Actions
  clearDraft: () => void;
}

export function useAiEmailDraft(): UseAiEmailDraftResult {
  const [draft, setDraft] = useState<AiDraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const generateQuickReply = useCallback(
    async (emailId: string): Promise<AiDraftResponse | null> => {
      setLoading(true);
      setError(undefined);
      setDraft(null);

      try {
        const result = await apolloClient.mutate<{
          generateMultipleDrafts: { drafts: { draft: AiDraftResponse }[]; recommendedTone: string };
        }>({
          mutation: GENERATE_QUICK_REPLY,
          variables: { emailId },
        });

        // Get the first draft from the recommended response
        const draftsResponse = result.data?.generateMultipleDrafts;
        const firstDraft = draftsResponse?.drafts?.[0]?.draft || null;
        setDraft(firstDraft);
        return firstDraft;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateFromPrompt = useCallback(
    async (
      emailId: string,
      prompt: string,
      tone: EmailTone = 'Professional'
    ): Promise<AiDraftResponse | null> => {
      setLoading(true);
      setError(undefined);
      setDraft(null);

      try {
        const result = await apolloClient.mutate<{ generateEmailDraft: AiDraftResponse }>({
          mutation: GENERATE_AI_REPLY,
          variables: {
            input: {
              emailId,
              tone,
            },
          },
        });

        const generatedDraft = result.data?.generateEmailDraft || null;
        setDraft(generatedDraft);
        return generatedDraft;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearDraft = useCallback(() => {
    setDraft(null);
    setError(undefined);
  }, []);

  return {
    generateQuickReply,
    generateFromPrompt,
    draft,
    loading,
    error,
    clearDraft,
  };
}
