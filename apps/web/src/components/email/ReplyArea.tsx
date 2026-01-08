'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Zap, Sparkles, Paperclip, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface ReplyAreaProps {
  threadId: string;
  disabled?: boolean;
  onSend: (body: string, attachments?: File[]) => Promise<void>;
  onGenerateQuickReply: () => Promise<string | null>;
  onGenerateFromPrompt: (prompt: string) => Promise<string | null>;
  className?: string;
}

export function ReplyArea({
  threadId: _threadId,
  disabled = false,
  onSend,
  onGenerateQuickReply,
  onGenerateFromPrompt,
  className,
}: ReplyAreaProps) {
  const [body, setBody] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [generatingQuick, setGeneratingQuick] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set to scrollHeight, capped at max height (300px)
      const newHeight = Math.min(textarea.scrollHeight, 300);
      textarea.style.height = `${Math.max(newHeight, 80)}px`;
    }
  }, [body]);

  // Handle quick AI reply
  const handleQuickReply = useCallback(async () => {
    setGeneratingQuick(true);
    try {
      const result = await onGenerateQuickReply();
      if (result) {
        setBody(result);
      }
    } finally {
      setGeneratingQuick(false);
    }
  }, [onGenerateQuickReply]);

  // Handle prompt-based AI generation
  const handleGenerateFromPrompt = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setGeneratingPrompt(true);
    try {
      const result = await onGenerateFromPrompt(aiPrompt.trim());
      if (result) {
        setBody(result);
        setAiPrompt('');
      }
    } finally {
      setGeneratingPrompt(false);
    }
  }, [aiPrompt, onGenerateFromPrompt]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!body.trim() || disabled) return;

    setSending(true);
    try {
      await onSend(body.trim(), attachments.length > 0 ? attachments : undefined);
      setBody('');
      setAttachments([]);
    } finally {
      setSending(false);
    }
  }, [body, attachments, disabled, onSend]);

  // Handle keyboard shortcut (Cmd/Ctrl + Enter)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle file attachment
  const handleAttach = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const fileArray = Array.from(files);
        // Validate file size (3MB max each)
        const validFiles = fileArray.filter((f) => f.size <= 3 * 1024 * 1024);
        // Limit to 10 files total
        const newAttachments = [...attachments, ...validFiles].slice(0, 10);
        setAttachments(newAttachments);
      }
    };
    input.click();
  }, [attachments]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isGenerating = generatingQuick || generatingPrompt;

  return (
    <div
      className={cn(
        'px-5 py-4 border-t border-linear-border-subtle bg-linear-bg-primary',
        className
      )}
    >
      {/* AI Options Bar */}
      <div className="flex items-center gap-2 mb-3">
        {/* Quick Reply Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleQuickReply}
          disabled={disabled || isGenerating}
          className={cn(
            'h-8 px-3',
            'bg-gradient-to-r from-linear-accent/10 to-purple-500/10',
            'hover:from-linear-accent/20 hover:to-purple-500/20'
          )}
        >
          {generatingQuick ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5 mr-1.5 text-linear-accent" />
          )}
          <span className="text-xs text-linear-accent">Răspuns rapid AI</span>
        </Button>

        {/* Prompt Input */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-linear-bg-tertiary border border-linear-border-subtle rounded-md">
          <Sparkles className="h-3.5 w-3.5 text-linear-text-tertiary flex-shrink-0" />
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && aiPrompt.trim()) {
                e.preventDefault();
                handleGenerateFromPrompt();
              }
            }}
            placeholder="Descrie ce vrei să răspunzi pentru AI..."
            disabled={disabled || isGenerating}
            className="flex-1 bg-transparent text-xs text-linear-text-primary placeholder:text-linear-text-tertiary outline-none"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateFromPrompt}
            disabled={disabled || isGenerating || !aiPrompt.trim()}
            className="h-6 px-2 text-xs"
          >
            {generatingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generează'}
          </Button>
        </div>
      </div>

      {/* Reply Textarea */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scrie un răspuns..."
        disabled={disabled || sending}
        className={cn(
          'w-full min-h-[80px] max-h-[300px] p-3 mb-3',
          'bg-linear-bg-tertiary border border-linear-border-subtle rounded-lg',
          'text-sm text-linear-text-primary placeholder:text-linear-text-tertiary',
          'resize-none outline-none overflow-y-auto',
          'focus:border-linear-accent/50',
          'transition-[height] duration-150 ease-out',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 bg-linear-bg-tertiary border border-linear-border-subtle rounded text-xs"
            >
              <Paperclip className="h-3 w-3 text-linear-text-tertiary" />
              <span className="text-linear-text-secondary max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-1 text-linear-text-tertiary hover:text-linear-error"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Attach Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAttach}
            disabled={disabled || sending || attachments.length >= 10}
            className="h-8"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Keyboard Hint */}
          <span className="text-xs text-linear-text-tertiary">⌘+Enter pentru a trimite</span>
        </div>

        {/* Send Button */}
        <Button onClick={handleSend} disabled={disabled || sending || !body.trim()} className="h-8">
          {sending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1.5" />
          )}
          Trimite
        </Button>
      </div>
    </div>
  );
}
