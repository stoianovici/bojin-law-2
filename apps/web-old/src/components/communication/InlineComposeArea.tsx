'use client';

/**
 * InlineComposeArea Component
 * OPS-363: Inline compose at bottom of message panel (not modal)
 *
 * Features:
 * - Toolbar with bold, italic, link, attach buttons
 * - AI draft generation with tone selector
 * - Textarea for composing
 * - Footer with keyboard hint and send button
 * - Attachments row (if any)
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Bold,
  Italic,
  Link2,
  Paperclip,
  Sparkles,
  Zap,
  Send,
  Loader2,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommunicationStore } from '../../stores/communication.store';
import { useNotificationStore } from '../../stores/notificationStore';
import { useGenerateDraft, type EmailTone } from '../../hooks/useEmailDraft';

// ============================================================================
// GraphQL Mutations
// ============================================================================

const REPLY_TO_EMAIL = gql`
  mutation ReplyToEmail($input: ReplyEmailInput!) {
    replyToEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface AttachmentFile {
  id: string;
  file: File;
  name: string;
  size: number;
  contentType: string;
}

interface InlineComposeAreaProps {
  /** Thread ID to reply to */
  threadId?: string;
  /** Callback after successful send */
  onSent?: () => void;
  /** Whether compose is disabled (e.g., NECLAR mode) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_TOTAL_ATTACHMENTS = 10;

const TONE_OPTIONS = [
  { value: 'professional', label: 'Profesional' },
  { value: 'formal', label: 'Formal' },
  { value: 'brief', label: 'Scurt' },
] as const;

const TONE_MAP: Record<string, EmailTone> = {
  formal: 'Formal',
  professional: 'Professional',
  brief: 'Brief',
};

// ============================================================================
// Component
// ============================================================================

export function InlineComposeArea({
  threadId,
  onSent,
  disabled = false,
  placeholder = 'Scrie răspunsul tău...',
  className,
}: InlineComposeAreaProps) {
  const { threads, getSelectedThread } = useCommunicationStore();
  const { addNotification } = useNotificationStore();

  // Get thread data
  const thread = threadId ? threads.find((t) => t.id === threadId) : getSelectedThread();
  const originalMessage = thread?.messages[thread.messages.length - 1];
  const emailId = originalMessage?.id || '';

  // State
  const [body, setBody] = useState('');
  const [selectedTone, setSelectedTone] = useState<'formal' | 'professional' | 'brief'>(
    'professional'
  );
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI draft generation
  const { generate, loading: aiLoading } = useGenerateDraft(emailId, TONE_MAP[selectedTone]);

  // GraphQL mutation
  const [replyToEmail, { loading: sending }] = useMutation(REPLY_TO_EMAIL);

  // Handle AI draft generation
  const handleGenerateDraft = useCallback(async () => {
    if (!emailId) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu se poate genera draft-ul fără context',
      });
      return;
    }

    try {
      const result = await generate();
      if (result?.body) {
        setBody(result.body);
        addNotification({
          type: 'success',
          title: 'Draft generat',
          message: 'Răspunsul AI a fost generat',
        });
      }
    } catch (error) {
      console.error('Failed to generate draft:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut genera draft-ul',
      });
    }
  }, [emailId, generate, addNotification]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!body.trim() || !thread) return;

    try {
      // Prepare attachments as base64
      const attachmentData = await Promise.all(
        attachments.map(async (att) => {
          const arrayBuffer = await att.file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          return {
            name: att.name,
            contentType: att.contentType,
            content: base64,
          };
        })
      );

      const result = await replyToEmail({
        variables: {
          input: {
            conversationId: thread.conversationId,
            body: body.trim(),
            includeOriginal: false,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
          },
        },
      });

      const data = result.data as { replyToEmail?: { success: boolean; error?: string } };
      if (data?.replyToEmail?.success) {
        setBody('');
        setAttachments([]);
        addNotification({
          type: 'success',
          title: 'Email trimis',
          message: 'Răspunsul a fost trimis cu succes',
        });
        onSent?.();
      } else {
        throw new Error(data?.replyToEmail?.error || 'Trimitere eșuată');
      }
    } catch (error: any) {
      console.error('Failed to send email:', error);
      addNotification({
        type: 'error',
        title: 'Eroare la trimitere',
        message: error.message || 'Nu s-a putut trimite email-ul',
      });
    }
  }, [body, thread, attachments, replyToEmail, addNotification, onSent]);

  // Handle keyboard shortcut (Cmd+Enter to send)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachmentError(null);

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setAttachmentError(`Fișierul ${file.name} depășește limita de 3MB`);
        continue;
      }

      setAttachments((prev) => {
        if (prev.length >= MAX_TOTAL_ATTACHMENTS) {
          setAttachmentError(`Maximum ${MAX_TOTAL_ATTACHMENTS} atașamente permise`);
          return prev;
        }
        return [
          ...prev,
          {
            id: `${Date.now()}-${file.name}`,
            file,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
          },
        ];
      });
    }

    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  }, []);

  // Remove attachment
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Get file icon based on type
  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) return FileText;
    if (contentType.includes('spreadsheet') || contentType.includes('excel'))
      return FileSpreadsheet;
    if (contentType.startsWith('image/')) return ImageIcon;
    return File;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (disabled) {
    return null;
  }

  return (
    <div
      className={cn('border-t border-linear-border-subtle bg-linear-bg-secondary p-3', className)}
    >
      <div
        className={cn(
          'bg-linear-bg-tertiary border rounded-xl overflow-hidden transition-all duration-150',
          isFocused
            ? 'border-linear-accent ring-2 ring-linear-accent/20'
            : 'border-linear-border-subtle'
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-linear-border-subtle">
          {/* Text formatting (placeholder - not functional yet) */}
          <button
            type="button"
            className="w-8 h-8 rounded-md flex items-center justify-center text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-md flex items-center justify-center text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-md flex items-center justify-center text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
            title="Link"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-linear-border-subtle mx-2" />

          {/* Attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 rounded-md flex items-center justify-center text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
            title="Atașează fișier"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* AI Tone Selector - Right side */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 px-1 py-0.5 bg-linear-accent/10 rounded-md">
              <span className="flex items-center gap-1 px-2 text-[11px] font-medium text-linear-accent">
                <Sparkles className="w-3.5 h-3.5" />
                AI
              </span>
              <select
                value={selectedTone}
                onChange={(e) =>
                  setSelectedTone(e.target.value as 'formal' | 'professional' | 'brief')
                }
                className="px-2 py-1 bg-linear-bg-secondary border border-linear-border-subtle rounded text-[11px] font-medium text-linear-text-primary cursor-pointer outline-none hover:border-linear-accent focus:border-linear-accent focus:ring-1 focus:ring-linear-accent/20"
              >
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={aiLoading || !emailId}
                className="flex items-center gap-1 px-2 py-1 bg-linear-accent text-white text-[11px] font-medium rounded hover:bg-linear-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                Generează
              </button>
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full min-h-[80px] bg-transparent border-none outline-none text-linear-text-primary text-sm leading-relaxed resize-none placeholder:text-linear-text-muted"
          />
        </div>

        {/* Attachments row */}
        {attachments.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => {
                const Icon = getFileIcon(att.contentType);
                return (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-linear-bg-secondary border border-linear-border-subtle rounded text-xs text-linear-text-secondary"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <span className="text-linear-text-muted">({formatSize(att.size)})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="ml-1 text-linear-text-muted hover:text-linear-text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {attachmentError && (
          <div className="px-4 pb-2">
            <p className="text-xs text-linear-error">{attachmentError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-linear-bg-elevated">
          <span className="text-[11px] text-linear-text-muted font-mono">
            {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter pentru a trimite
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white text-[13px] font-medium rounded-lg hover:bg-linear-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Trimite
          </button>
        </div>
      </div>
    </div>
  );
}

InlineComposeArea.displayName = 'InlineComposeArea';

export default InlineComposeArea;
