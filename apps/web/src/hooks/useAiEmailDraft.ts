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
    async (threadId: string): Promise<AiDraftResponse | null> => {
      setLoading(true);
      setError(undefined);
      setDraft(null);

      try {
        const result = await apolloClient.mutate<{ generateQuickReply: AiDraftResponse }>({
          mutation: GENERATE_QUICK_REPLY,
          variables: { threadId },
        });

        const generatedDraft = result.data?.generateQuickReply || null;
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

  const generateFromPrompt = useCallback(
    async (
      threadId: string,
      prompt: string,
      tone: EmailTone = 'Professional'
    ): Promise<AiDraftResponse | null> => {
      setLoading(true);
      setError(undefined);
      setDraft(null);

      try {
        const result = await apolloClient.mutate<{ generateAiReply: AiDraftResponse }>({
          mutation: GENERATE_AI_REPLY,
          variables: {
            input: {
              threadId,
              prompt,
              tone,
            },
          },
        });

        const generatedDraft = result.data?.generateAiReply || null;
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
