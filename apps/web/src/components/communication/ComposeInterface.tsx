'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { useGenerateDraft, type EmailTone } from '../../hooks/useEmailDraft';
import {
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  Send,
  CheckCircle,
  Save,
  Paperclip,
  FileIcon,
} from 'lucide-react';

// GraphQL mutations for sending emails
const SEND_NEW_EMAIL = gql`
  mutation SendNewEmail($input: SendEmailInput!) {
    sendNewEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

const REPLY_TO_EMAIL = gql`
  mutation ReplyToEmail($input: ReplyEmailInput!) {
    replyToEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

// Type definitions for mutation results
interface SendEmailResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

interface SendNewEmailData {
  sendNewEmail: SendEmailResult;
}

interface ReplyToEmailData {
  replyToEmail: SendEmailResult;
}

// Attachment type for UI state
interface AttachmentFile {
  id: string;
  file: File;
  name: string;
  size: number;
  contentType: string;
}

// Max file size: 3MB (MS Graph API attachment limit for small files in JSON body)
const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS = 10;

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
    draftTo,
    draftCc,
    draftSubject,
    updateDraft,
    updateDraftFields,
    saveDraft,
    clearSavedDraft,
    closeCompose,
  } = useCommunicationStore();

  const [to, setTo] = useState(draftTo);
  const [cc, _setCc] = useState(draftCc); // CC field not yet exposed in UI
  const [subject, setSubject] = useState(draftSubject);
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'formal' | 'professional' | 'brief'>(
    'professional'
  );
  const [showAIDraft, setShowAIDraft] = useState(false);
  const [generatedDraftBody, setGeneratedDraftBody] = useState<string | null>(null);
  const [generationCompleted, setGenerationCompleted] = useState(false);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // GraphQL mutations
  const [sendNewEmail, { loading: sendingNew }] = useMutation<SendNewEmailData>(SEND_NEW_EMAIL);
  const [replyToEmail, { loading: sendingReply }] = useMutation<ReplyToEmailData>(REPLY_TO_EMAIL);
  const isSending = sendingNew || sendingReply;

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

  // Track previous compose mode to detect changes
  const prevComposeModeRef = useRef(composeMode);
  const prevOriginalMessageIdRef = useRef(originalMessage?.id);

  // Auto-populate fields when compose mode changes
  // Using useLayoutEffect to run synchronously before paint
  useLayoutEffect(() => {
    const composeModeChanged = prevComposeModeRef.current !== composeMode;
    const messageChanged = prevOriginalMessageIdRef.current !== originalMessage?.id;

    if (composeModeChanged || messageChanged) {
      if (composeMode === 'reply' && originalMessage) {
        // Only set if not already populated from saved draft
        if (!draftTo) {
          setTo(originalMessage.senderEmail);
        }
        if (!draftSubject) {
          setSubject(`Re: ${thread?.subject || originalMessage.subject}`);
        }
        setShowAIDraft(true);
        setGeneratedDraftBody(null);
        setGenerationCompleted(false);
      } else if (composeMode === 'new') {
        if (!draftTo) setTo('');
        if (!draftSubject) setSubject('');
        setShowAIDraft(false);
        setGeneratedDraftBody(null);
        setGenerationCompleted(false);
      }

      prevComposeModeRef.current = composeMode;
      prevOriginalMessageIdRef.current = originalMessage?.id;
    }
  }, [composeMode, originalMessage, thread, draftTo, draftSubject]);

  // Sync local state to store for persistence
  useEffect(() => {
    updateDraftFields({ to, cc, subject, body: draftBody });
  }, [to, cc, subject, draftBody, updateDraftFields]);

  // Auto-save draft every 30 seconds if there's content
  useEffect(() => {
    if (!isComposeOpen) return;

    const autoSaveInterval = setInterval(() => {
      if (to.trim() || subject.trim() || draftBody.trim()) {
        saveDraft();
        setLastSaved(new Date());
        console.log('[ComposeInterface] Draft auto-saved');
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [isComposeOpen, to, subject, draftBody, saveDraft]);

  // Manual save draft handler
  const handleSaveDraft = () => {
    saveDraft();
    setLastSaved(new Date());
  };

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
        console.error('[ComposeInterface] GraphQL error:', aiError.message);
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

  // Handle file selection for attachments
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setAttachmentError(null);

      const newAttachments: AttachmentFile[] = [];
      const errors: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file count limit
        if (attachments.length + newAttachments.length >= MAX_TOTAL_ATTACHMENTS) {
          errors.push(`Maximum ${MAX_TOTAL_ATTACHMENTS} attachments allowed.`);
          break;
        }

        // Check file size
        if (file.size > MAX_ATTACHMENT_SIZE) {
          errors.push(`"${file.name}" exceeds 3MB limit.`);
          continue;
        }

        newAttachments.push({
          id: `${Date.now()}-${i}`,
          file,
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
        });
      }

      if (errors.length > 0) {
        setAttachmentError(errors.join(' '));
      }

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }

      // Reset input
      e.target.value = '';
    },
    [attachments.length]
  );

  // Remove attachment
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    setAttachmentError(null);
  }, []);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle send email
  const handleSendEmail = async () => {
    // Validate required fields
    if (!to.trim()) {
      setSendError('Vă rugăm să introduceți un destinatar.');
      setSendStatus('error');
      return;
    }

    if (!subject.trim()) {
      setSendError('Vă rugăm să introduceți un subiect.');
      setSendStatus('error');
      return;
    }

    if (!draftBody.trim()) {
      setSendError('Vă rugăm să scrieți un mesaj.');
      setSendStatus('error');
      return;
    }

    setSendStatus('sending');
    setSendError(null);

    try {
      // Convert attachments to base64
      const attachmentData = await Promise.all(
        attachments.map(async (att) => ({
          name: att.name,
          contentType: att.contentType,
          contentBase64: await fileToBase64(att.file),
        }))
      );

      let result;

      if (composeMode === 'reply' && thread) {
        // Reply to existing thread - use thread.id as conversationId
        // The thread object from the store has conversationId added at runtime
        const threadConversationId = (thread as any).conversationId || thread.id;
        result = await replyToEmail({
          variables: {
            input: {
              conversationId: threadConversationId,
              to: [to.trim()],
              subject: subject.trim(),
              body: draftBody.trim(),
              isHtml: false,
              includeOriginal,
              attachments: attachmentData.length > 0 ? attachmentData : undefined,
            },
          },
        });

        if (result.data?.replyToEmail?.success) {
          setSendStatus('success');
          clearSavedDraft(); // Clear saved draft after successful send
          // Reset form and close after short delay
          setTimeout(() => {
            updateDraft('');
            setAttachments([]);
            closeCompose();
            setSendStatus('idle');
          }, 1500);
        } else {
          setSendError(result.data?.replyToEmail?.error || 'Nu s-a putut trimite răspunsul.');
          setSendStatus('error');
        }
      } else {
        // Send new email
        result = await sendNewEmail({
          variables: {
            input: {
              to: [to.trim()],
              subject: subject.trim(),
              body: draftBody.trim(),
              isHtml: false,
              attachments: attachmentData.length > 0 ? attachmentData : undefined,
            },
          },
        });

        if (result.data?.sendNewEmail?.success) {
          setSendStatus('success');
          clearSavedDraft(); // Clear saved draft after successful send
          // Reset form and close after short delay
          setTimeout(() => {
            setTo('');
            setSubject('');
            updateDraft('');
            setAttachments([]);
            closeCompose();
            setSendStatus('idle');
          }, 1500);
        } else {
          setSendError(result.data?.sendNewEmail?.error || 'Nu s-a putut trimite emailul.');
          setSendStatus('error');
        }
      }
    } catch (error: any) {
      console.error('[ComposeInterface] Send error:', error);
      setSendError(error.message || 'Eroare la trimiterea emailului.');
      setSendStatus('error');
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

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Atașamente:</label>
              <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                <span>Adaugă fișiere</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={attachments.length >= MAX_TOTAL_ATTACHMENTS}
                />
              </label>
            </div>

            {/* Attachment error */}
            {attachmentError && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-2">
                {attachmentError}
              </div>
            )}

            {/* Attachment list */}
            {attachments.length > 0 ? (
              <div className="border rounded p-2 space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate" title={att.name}>
                        {att.name}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ({formatFileSize(att.size)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Elimină"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded p-3 text-sm text-gray-400 text-center border-dashed">
                Niciun atașament (max 3MB per fișier, {MAX_TOTAL_ATTACHMENTS} fișiere)
              </div>
            )}
          </div>

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

        {/* Send Error */}
        {sendStatus === 'error' && sendError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {sendError}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSendEmail}
              disabled={isSending || sendStatus === 'success'}
              className={`px-4 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
                sendStatus === 'success'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {sendStatus === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Trimis!
                </>
              ) : isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se trimite...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Trimite
                </>
              )}
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={isSending}
              className="px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Salvează
            </button>
            {lastSaved && (
              <span className="text-xs text-gray-400">
                Salvat:{' '}
                {lastSaved.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <button
            onClick={closeCompose}
            disabled={isSending}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}
