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
      console.log('[useAiEmailDraft] generateQuickReply called with emailId:', emailId);
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

        console.log('[useAiEmailDraft] generateQuickReply result:', result);

        // Get the first draft from the recommended response
        const draftsResponse = result.data?.generateMultipleDrafts;
        const firstDraft = draftsResponse?.drafts?.[0]?.draft || null;

        if (!firstDraft) {
          console.warn('[useAiEmailDraft] No draft returned from generateMultipleDrafts');
        }

        setDraft(firstDraft);
        return firstDraft;
      } catch (err) {
        console.error('[useAiEmailDraft] generateQuickReply error:', err);
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
      console.log('[useAiEmailDraft] generateFromPrompt called:', { emailId, prompt, tone });
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

        console.log('[useAiEmailDraft] generateFromPrompt result:', result);

        const generatedDraft = result.data?.generateEmailDraft || null;

        if (!generatedDraft) {
          console.warn('[useAiEmailDraft] No draft returned from generateEmailDraft');
        }

        setDraft(generatedDraft);
        return generatedDraft;
      } catch (err) {
        console.error('[useAiEmailDraft] generateFromPrompt error:', err);
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
