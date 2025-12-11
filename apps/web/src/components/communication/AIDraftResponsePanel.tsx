'use client';

/**
 * AI Draft Response Panel Component
 * Story 5.3: AI-Powered Email Drafting
 *
 * Generates AI-powered email draft responses using GraphQL mutations.
 * Allows tone selection and displays generated drafts with actions.
 */

import { useState, useCallback } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { useGenerateDraft, type EmailTone, type EmailDraft } from '../../hooks/useEmailDraft';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

type ToneOption = 'formal' | 'professional' | 'brief';

const TONE_MAP: Record<ToneOption, EmailTone> = {
  formal: 'Formal',
  professional: 'Professional',
  brief: 'Brief',
};

const TONE_LABELS: Record<ToneOption, string> = {
  formal: 'Formal',
  professional: 'Professional',
  brief: 'Scurt',
};

export function AIDraftResponsePanel() {
  const [tone, setTone] = useState<ToneOption>('professional');
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded for discoverability
  const [generatedDraft, setGeneratedDraft] = useState<EmailDraft | null>(null);
  const [copied, setCopied] = useState(false);

  const { getSelectedThread, openCompose, updateDraft } = useCommunicationStore();
  const thread = getSelectedThread();

  // Get the latest email from thread for generating response
  const latestEmail = thread?.messages?.[thread.messages.length - 1];
  const emailId = latestEmail?.id;

  const { generate, loading, error } = useGenerateDraft(emailId || '', TONE_MAP[tone]);

  const handleGenerateDraft = useCallback(async () => {
    if (!emailId) {
      console.warn('[AIDraft] No emailId available');
      return;
    }

    console.log('[AIDraft] Generating draft for emailId:', emailId, 'tone:', TONE_MAP[tone]);

    try {
      const draft = await generate(TONE_MAP[tone]);
      console.log('[AIDraft] Draft result:', draft);
      if (draft) {
        setGeneratedDraft(draft);
      }
    } catch (err) {
      console.error('[AIDraft] Failed to generate draft:', err);
    }
  }, [emailId, generate, tone]);

  const handleToneChange = useCallback(
    async (newTone: ToneOption) => {
      setTone(newTone);
      // Auto-regenerate if we already have a draft
      if (generatedDraft && emailId) {
        try {
          const draft = await generate(TONE_MAP[newTone]);
          if (draft) {
            setGeneratedDraft(draft);
          }
        } catch (err) {
          console.error('Failed to regenerate draft:', err);
        }
      }
    },
    [emailId, generate, generatedDraft]
  );

  const handleUseDraft = useCallback(() => {
    if (!generatedDraft) return;

    // Open compose with draft body
    openCompose('reply', thread?.id);
    updateDraft(generatedDraft.body);
  }, [generatedDraft, openCompose, thread?.id, updateDraft]);

  const handleCopyDraft = useCallback(async () => {
    if (!generatedDraft) return;

    try {
      await navigator.clipboard.writeText(generatedDraft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy draft:', err);
    }
  }, [generatedDraft]);

  if (!thread) return null;

  return (
    <div className="border-t bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Sugestie răspuns AI
          {loading && <Loader2 className="h-3 w-3 animate-spin text-purple-500" />}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t space-y-3 max-h-80 overflow-y-auto">
          {/* Tone selector */}
          <div className="flex gap-2">
            {(['formal', 'professional', 'brief'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleToneChange(t)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
                  tone === t ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Error state */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-medium">Eroare la generare</p>
                <p className="text-red-600 text-xs mt-1">{error.message}</p>
              </div>
            </div>
          )}

          {/* Draft content or generate button */}
          {generatedDraft ? (
            <>
              <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {generatedDraft.body}
              </div>

              {/* Confidence indicator */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Încredere AI:{' '}
                  <span
                    className={
                      generatedDraft.confidence >= 0.8
                        ? 'text-green-600'
                        : generatedDraft.confidence >= 0.5
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }
                  >
                    {Math.round(generatedDraft.confidence * 100)}%
                  </span>
                </span>
                <span className="text-gray-400">Ton: {generatedDraft.tone}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleUseDraft}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                >
                  Folosește draft
                </button>
                <button
                  onClick={handleCopyDraft}
                  className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-green-600" />
                      Copiat
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiază
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerateDraft}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  Regenerează
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">
                Generați un răspuns automat bazat pe conversația curentă
              </p>
              <button
                onClick={handleGenerateDraft}
                disabled={loading || !emailId}
                className="px-4 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se generează...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generează draft
                  </>
                )}
              </button>
              {!emailId && (
                <p className="text-xs text-gray-400 mt-2">
                  Selectați o conversație pentru a genera un răspuns
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
