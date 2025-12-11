'use client';

import { useState, useEffect, useCallback } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { useGenerateDraft, type EmailTone } from '../../hooks/useEmailDraft';
import { X, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// Map UI tone options to GraphQL enum values
const TONE_MAP: Record<'formal' | 'professional' | 'brief', EmailTone> = {
  formal: 'Formal',
  professional: 'Professional',
  brief: 'Brief',
};

export function ComposeInterface() {
  const {
    isComposeOpen,
    composeMode,
    composeThreadId,
    threads,
    draftBody,
    updateDraft,
    closeCompose,
  } = useCommunicationStore();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'formal' | 'professional' | 'brief'>(
    'professional'
  );
  const [showAIDraft, setShowAIDraft] = useState(false);
  const [generatedDraftBody, setGeneratedDraftBody] = useState<string | null>(null);
  const [generationCompleted, setGenerationCompleted] = useState(false);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  // Get the thread for reply mode
  const thread = composeThreadId ? threads.find((t) => t.id === composeThreadId) : null;

  // Get the last message for reply context
  const originalMessage = thread?.messages[thread.messages.length - 1];

  // Email ID for AI draft generation
  const emailId = originalMessage?.id || '';

  // AI draft generation hook
  const {
    generate,
    loading: aiLoading,
    error: aiError,
  } = useGenerateDraft(emailId, TONE_MAP[selectedTone]);

  // Auto-populate fields when in reply mode
  useEffect(() => {
    if (composeMode === 'reply' && originalMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTo(originalMessage.senderEmail);

      setSubject(`Re: ${thread?.subject || originalMessage.subject}`);

      setShowAIDraft(true); // Show AI draft panel for replies
      setGeneratedDraftBody(null); // Reset generated draft when thread changes
      setGenerationCompleted(false); // Reset completion state
    } else {
      setTo('');

      setSubject('');

      setShowAIDraft(false);
      setGeneratedDraftBody(null);
      setGenerationCompleted(false);
    }
  }, [composeMode, originalMessage, thread]);

  // Generate AI draft
  const handleGenerateDraft = useCallback(async () => {
    if (!emailId) {
      console.warn('[ComposeInterface] No emailId available for draft generation');
      return;
    }

    console.log(
      '[ComposeInterface] Starting draft generation for emailId:',
      emailId,
      'tone:',
      TONE_MAP[selectedTone]
    );
    setGenerationCompleted(false);

    try {
      const draft = await generate(TONE_MAP[selectedTone]);
      console.log('[ComposeInterface] Draft result:', draft);

      // Check if there was an error from the hook
      if (aiError) {
        console.error('[ComposeInterface] GraphQL error:', aiError.message, aiError.graphQLErrors);
      }

      setGenerationCompleted(true);
      if (draft?.body) {
        setGeneratedDraftBody(draft.body);
      } else {
        console.warn('[ComposeInterface] Draft returned but no body:', draft);
        setGeneratedDraftBody(null);
      }
    } catch (err) {
      console.error('[ComposeInterface] Failed to generate draft:', err);
      setGenerationCompleted(true);
    }
  }, [emailId, generate, selectedTone, aiError]);

  // Reset generation attempt when email or tone changes
  useEffect(() => {
    setHasAttemptedGeneration(false); // eslint-disable-line react-hooks/set-state-in-effect -- intentional: reset flag when dependencies change
  }, [emailId, selectedTone]);

  // Auto-generate draft when panel opens (only once per email/tone)
  useEffect(() => {
    if (
      showAIDraft &&
      emailId &&
      !generatedDraftBody &&
      !aiLoading &&
      !hasAttemptedGeneration &&
      !aiError
    ) {
      console.log('[ComposeInterface] Auto-triggering draft generation');
      setHasAttemptedGeneration(true); // eslint-disable-line react-hooks/set-state-in-effect -- intentional: one-time trigger flag
      handleGenerateDraft();
    }
  }, [
    showAIDraft,
    emailId,
    generatedDraftBody,
    aiLoading,
    hasAttemptedGeneration,
    aiError,
    handleGenerateDraft,
  ]);

  const handleUseAIDraft = () => {
    if (generatedDraftBody) {
      updateDraft(generatedDraftBody);
    }
  };

  if (!isComposeOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">
            {composeMode === 'new' && 'Mesaj nou'}
            {composeMode === 'reply' && 'Răspunde'}
            {composeMode === 'forward' && 'Redirecționează'}
          </h2>
          <button
            onClick={closeCompose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Către:</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Destinatar..."
              className="w-full border rounded px-3 py-2 text-sm"
              readOnly={composeMode === 'reply'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subiect:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subiect..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* AI Draft Panel for replies */}
          {showAIDraft && composeMode === 'reply' && (
            <div className="p-3 bg-purple-50 rounded border border-purple-200">
              <div className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Răspuns generat de AI
                {aiLoading && <Loader2 className="h-3 w-3 animate-spin text-purple-500" />}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <label className="text-xs font-medium">Ton:</label>
                  <select
                    value={selectedTone}
                    onChange={(e) => {
                      const newTone = e.target.value as 'formal' | 'professional' | 'brief';
                      console.log('[ComposeInterface] Tone changed to:', newTone);
                      setSelectedTone(newTone);
                      setGeneratedDraftBody(null); // Reset to regenerate with new tone
                      // hasAttemptedGeneration will reset via useEffect dependency on selectedTone
                    }}
                    disabled={aiLoading}
                    className="text-xs border rounded px-2 py-1 disabled:opacity-50"
                  >
                    <option value="formal">Formal</option>
                    <option value="professional">Profesional</option>
                    <option value="brief">Scurt</option>
                  </select>
                  <button
                    onClick={() => {
                      console.log('[ComposeInterface] Manual regenerate clicked');
                      setHasAttemptedGeneration(false);
                      setGeneratedDraftBody(null);
                      handleGenerateDraft();
                    }}
                    disabled={aiLoading || !emailId}
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${aiLoading ? 'animate-spin' : ''}`} />
                    Regenerează
                  </button>
                  <button
                    onClick={handleUseAIDraft}
                    disabled={!generatedDraftBody || aiLoading}
                    className="ml-auto px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Folosește draft AI
                  </button>
                </div>

                {/* Error state */}
                {aiError && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-start gap-2">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Eroare:</span> {aiError.message}
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {aiLoading && !generatedDraftBody && (
                  <div className="text-xs text-gray-500 bg-white p-3 rounded border text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Se generează răspunsul...
                  </div>
                )}

                {/* Generated draft */}
                {generatedDraftBody && (
                  <div className="text-xs text-gray-600 bg-white p-2 rounded border max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {generatedDraftBody}
                  </div>
                )}

                {/* No email ID warning */}
                {!emailId && !aiLoading && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    Nu se poate genera draft - emailul nu a fost găsit.
                  </div>
                )}

                {/* Generation completed but no draft (server error or empty response) */}
                {emailId &&
                  !aiLoading &&
                  !generatedDraftBody &&
                  !aiError &&
                  generationCompleted && (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                      Nu s-a putut genera răspunsul. Apăsați &quot;Regenerează&quot; pentru a
                      încerca din nou.
                    </div>
                  )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Mesaj:</label>
            <textarea
              value={draftBody}
              onChange={(e) => updateDraft(e.target.value)}
              placeholder="Scrie mesajul..."
              className="w-full border rounded px-3 py-2 text-sm h-64"
            />
          </div>

          {/* Include original message toggle for replies */}
          {composeMode === 'reply' && originalMessage && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeOriginal"
                checked={includeOriginal}
                onChange={(e) => setIncludeOriginal(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="includeOriginal" className="text-sm text-gray-700 cursor-pointer">
                Include mesajul original în răspuns
              </label>
            </div>
          )}

          {/* Natural Language Enhancements Mockup */}
          {composeMode === 'new' && (
            <div className="p-3 bg-blue-50 rounded text-sm">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Sugestii inteligente
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div>• Referință dosar detectată: Dosar #12345</div>
                <div>• Termen sugerat: 15 martie 2025</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <button className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Trimite (Mockup)
          </button>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">
              Salvează draft
            </button>
            <button
              onClick={closeCompose}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Anulează
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
