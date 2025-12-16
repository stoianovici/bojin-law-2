/**
 * TaskSuggestionPrompt - Non-intrusive prompt for AI-suggested tasks
 * Story 5.6: AI Learning and Personalization (Task 31)
 * Shows when a pattern matches current context
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useTaskSuggestionWatcher,
  getConfidenceLabel,
  type SuggestedTask,
  type TriggerContext,
} from '@/hooks/useTaskPatterns';

// Icons
const LightbulbIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700',
};

export interface TaskSuggestionPromptProps {
  context: TriggerContext | null;
  caseId: string;
  onTaskCreated?: (taskId: string) => void;
  className?: string;
  variant?: 'banner' | 'toast' | 'inline';
}

/**
 * Customization dialog for editing the suggested task before accepting
 */
function CustomizeDialog({
  suggestion,
  open,
  onClose,
  onAccept,
  loading,
}: {
  suggestion: SuggestedTask;
  open: boolean;
  onClose: () => void;
  onAccept: (customizedTitle: string, customizedPriority: string) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [priority, setPriority] = useState(suggestion.priority);

  useEffect(() => {
    setTitle(suggestion.title);
    setPriority(suggestion.priority);
  }, [suggestion]);

  const handleAccept = () => {
    onAccept(title, priority);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizează Task-ul</DialogTitle>
          <DialogDescription>Ajustează detaliile task-ului înainte de a-l crea</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium" htmlFor="customTitle">
              Titlu
            </label>
            <Input
              id="customTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="customPriority">
              Prioritate
            </label>
            <select
              id="customPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="Low">Scăzută</option>
              <option value="Medium">Medie</option>
              <option value="High">Înaltă</option>
              <option value="Urgent">Urgentă</option>
            </select>
          </div>

          {suggestion.suggestedDueDate && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Deadline sugerat:</span>{' '}
              {new Date(suggestion.suggestedDueDate).toLocaleDateString('ro-RO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button onClick={handleAccept} disabled={loading || !title.trim()}>
            {loading ? 'Se creează...' : 'Creează Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dismiss reason dialog
 */
function DismissDialog({
  open,
  onClose,
  onDismiss,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onDismiss: (reason: string, dontShowAgain: boolean) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleDismiss = () => {
    onDismiss(reason, dontShowAgain);
    setReason('');
    setDontShowAgain(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respinge sugestia</DialogTitle>
          <DialogDescription>Ajută-ne să îmbunătățim sugestiile prin feedback</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium" htmlFor="dismissReason">
              Motivul respingerii (opțional)
            </label>
            <select
              id="dismissReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selectează un motiv...</option>
              <option value="not_relevant">Nu este relevant acum</option>
              <option value="wrong_task_type">Tip de task greșit</option>
              <option value="already_done">Task-ul există deja</option>
              <option value="wrong_timing">Moment nepotrivit</option>
              <option value="other">Altul</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Nu mai sugera acest tip de task pentru acest context</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button onClick={handleDismiss} disabled={loading}>
            {loading ? 'Se procesează...' : 'Respinge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Banner variant - appears at top of content area
 */
function BannerPrompt({
  suggestion,
  onAccept,
  onCustomize,
  onDismiss,
  accepting,
  className,
}: {
  suggestion: SuggestedTask;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
  accepting: boolean;
  className?: string;
}) {
  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-lg border
        bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="p-2 bg-primary/10 rounded-full shrink-0">
        <LightbulbIcon className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Sugestie de task:</span>
          <span className="text-sm">{suggestion.title}</span>
          <Badge className={PRIORITY_COLORS[suggestion.priority] || ''}>
            {suggestion.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>Pattern: {suggestion.pattern.patternName}</span>
          <span>
            Încredere: {getConfidenceLabel(suggestion.confidence)} (
            {Math.round(suggestion.confidence * 100)}%)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onAccept} disabled={accepting} className="gap-1">
          <CheckIcon />
          {accepting ? 'Se creează...' : 'Acceptă'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCustomize} className="gap-1">
          <EditIcon />
          Personalizează
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          title="Respinge sugestia"
          aria-label="Respinge sugestia"
        >
          <CloseIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Toast variant - floating notification
 */
function ToastPrompt({
  suggestion,
  onAccept,
  onCustomize,
  onDismiss,
  accepting,
  className,
}: {
  suggestion: SuggestedTask;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
  accepting: boolean;
  className?: string;
}) {
  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 w-96 rounded-lg border shadow-lg
        bg-background animate-in slide-in-from-bottom-5
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-full shrink-0">
            <LightbulbIcon className="text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sugestie de task</p>
            <p className="text-sm mt-1">{suggestion.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={PRIORITY_COLORS[suggestion.priority] || ''}>
                {suggestion.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {Math.round(suggestion.confidence * 100)}% încredere
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="shrink-0 -mt-1 -mr-1"
            aria-label="Închide"
          >
            <CloseIcon />
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" onClick={onAccept} disabled={accepting} className="flex-1">
            {accepting ? 'Se creează...' : 'Acceptă'}
          </Button>
          <Button variant="outline" size="sm" onClick={onCustomize} className="flex-1">
            Personalizează
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline variant - fits within content flow
 */
function InlinePrompt({
  suggestion,
  onAccept,
  onCustomize,
  onDismiss,
  accepting,
  className,
}: {
  suggestion: SuggestedTask;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
  accepting: boolean;
  className?: string;
}) {
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-md border
        bg-muted/30 border-muted
        ${className}
      `}
      role="alert"
    >
      <LightbulbIcon className="text-primary shrink-0 h-4 w-4" />

      <div className="flex-1 min-w-0 text-sm">
        <span className="text-muted-foreground">Sugestie:</span>{' '}
        <span className="font-medium">{suggestion.title}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAccept}
          disabled={accepting}
          className="h-7 text-xs"
        >
          {accepting ? '...' : 'Acceptă'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCustomize} className="h-7 text-xs">
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-7 px-1"
          aria-label="Respinge"
        >
          <CloseIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Main TaskSuggestionPrompt component
 * Watches for context changes and shows suggestion when pattern matches
 */
export function TaskSuggestionPrompt({
  context,
  caseId,
  onTaskCreated,
  className = '',
  variant = 'banner',
}: TaskSuggestionPromptProps) {
  const {
    suggestion,
    hasSuggestion,
    loading,
    accepting,
    dismissing,
    acceptSuggestion,
    dismissSuggestion,
  } = useTaskSuggestionWatcher(context);

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when suggestion changes
  useEffect(() => {
    if (suggestion) {
      setDismissed(false);
    }
  }, [suggestion?.pattern.id]);

  const handleAccept = useCallback(async () => {
    if (!suggestion) return;

    const result = await acceptSuggestion(suggestion.pattern.id, caseId);
    if (result?.id) {
      onTaskCreated?.(result.id);
    }
  }, [suggestion, acceptSuggestion, caseId, onTaskCreated]);

  const handleCustomize = useCallback(() => {
    setCustomizeOpen(true);
  }, []);

  const handleCustomizedAccept = useCallback(
    async (_customizedTitle: string, _customizedPriority: string) => {
      // In a full implementation, we'd pass these customizations to the API
      // For now, just accept with the original suggestion
      await handleAccept();
      setCustomizeOpen(false);
    },
    [handleAccept]
  );

  const handleDismiss = useCallback(() => {
    setDismissOpen(true);
  }, []);

  const handleDismissConfirm = useCallback(
    async (reason: string, _dontShowAgain: boolean) => {
      if (!suggestion) return;

      await dismissSuggestion(suggestion.pattern.id, reason);
      setDismissed(true);
      setDismissOpen(false);
    },
    [suggestion, dismissSuggestion]
  );

  // Don't show if loading, no suggestion, or dismissed
  if (loading || !hasSuggestion || !suggestion || dismissed) {
    return null;
  }

  const promptProps = {
    suggestion,
    onAccept: handleAccept,
    onCustomize: handleCustomize,
    onDismiss: handleDismiss,
    accepting,
    className,
  };

  return (
    <>
      {variant === 'banner' && <BannerPrompt {...promptProps} />}
      {variant === 'toast' && <ToastPrompt {...promptProps} />}
      {variant === 'inline' && <InlinePrompt {...promptProps} />}

      {/* Customize Dialog */}
      {suggestion && (
        <CustomizeDialog
          suggestion={suggestion}
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          onAccept={handleCustomizedAccept}
          loading={accepting}
        />
      )}

      {/* Dismiss Dialog */}
      <DismissDialog
        open={dismissOpen}
        onClose={() => setDismissOpen(false)}
        onDismiss={handleDismissConfirm}
        loading={dismissing}
      />
    </>
  );
}

TaskSuggestionPrompt.displayName = 'TaskSuggestionPrompt';

/**
 * Simple hook wrapper for embedding suggestion prompts
 */
export function useTaskSuggestion(context: TriggerContext | null) {
  const { suggestion, hasSuggestion, loading, acceptSuggestion, dismissSuggestion } =
    useTaskSuggestionWatcher(context);

  return {
    suggestion,
    hasSuggestion,
    loading,
    acceptSuggestion,
    dismissSuggestion,
  };
}
