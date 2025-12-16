/**
 * FeedbackDialog - Dialog for collecting suggestion feedback
 * Story 5.4: Proactive AI Suggestions System (Task 33)
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecordFeedback, SuggestionFeedbackInput } from '@/hooks/useSuggestions';
import type { AISuggestion } from '@legal-platform/types';

export interface FeedbackDialogProps {
  suggestion: AISuggestion | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (feedback: SuggestionFeedbackInput) => void;
  action?: 'dismiss' | 'modify';
}

const dismissReasons = [
  { id: 'not_relevant', label: 'Nu este relevant acum', icon: '🤷' },
  { id: 'already_handled', label: 'Deja rezolvat', icon: '✅' },
  { id: 'incorrect', label: 'Sugestie incorectă', icon: '❌' },
  { id: 'not_helpful', label: 'Nu este util', icon: '👎' },
];

/**
 * FeedbackDialog collects user feedback when dismissing
 * or modifying AI suggestions for learning purposes.
 */
export function FeedbackDialog({
  suggestion,
  isOpen,
  onClose,
  onSubmit,
  action = 'dismiss',
}: FeedbackDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [alternativeAction, setAlternativeAction] = useState('');
  const { recordFeedback, loading } = useRecordFeedback();

  const handleSubmit = async () => {
    if (!suggestion) return;

    const reason = selectedReason === 'other' ? customReason : selectedReason;

    const feedbackInput: SuggestionFeedbackInput = {
      suggestionId: suggestion.id,
      action: action === 'dismiss' ? 'dismissed' : 'modified',
      feedbackReason: reason || undefined,
      modifiedAction: alternativeAction ? { alternativeAction } : undefined,
    };

    await recordFeedback(feedbackInput);
    onSubmit?.(feedbackInput);
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    setAlternativeAction('');
    onClose();
  };

  if (!suggestion) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === 'dismiss' ? 'De ce respingi această sugestie?' : 'Ce ai făcut în schimb?'}
          </DialogTitle>
          <DialogDescription>
            Feedback-ul tău ne ajută să îmbunătățim sugestiile AI.
          </DialogDescription>
        </DialogHeader>

        {/* Suggestion preview */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{suggestion.type}</Badge>
            <Badge variant="outline">{suggestion.category}</Badge>
          </div>
          <p className="font-medium">{suggestion.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
        </div>

        {/* Reason selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">
            {action === 'dismiss' ? 'Selectează un motiv:' : 'Ce acțiune ai luat?'}
          </label>

          {action === 'dismiss' ? (
            <div className="grid grid-cols-2 gap-2">
              {dismissReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    selectedReason === reason.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  aria-pressed={selectedReason === reason.id}
                >
                  <span>{reason.icon}</span>
                  <span className="text-sm">{reason.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={alternativeAction}
              onChange={(e) => setAlternativeAction(e.target.value)}
              placeholder="Descrie ce ai făcut în schimb..."
              className="w-full min-h-[100px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Acțiune alternativă"
            />
          )}

          {/* Other option with text input */}
          {action === 'dismiss' && (
            <>
              <button
                onClick={() => setSelectedReason('other')}
                className={`w-full flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                  selectedReason === 'other'
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-primary/50'
                }`}
                aria-pressed={selectedReason === 'other'}
              >
                <span>💬</span>
                <span className="text-sm">Alt motiv</span>
              </button>

              {selectedReason === 'other' && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Descrie motivul..."
                  className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Motiv personalizat"
                  autoFocus
                />
              )}
            </>
          )}

          {/* Optional alternative action for dismiss */}
          {action === 'dismiss' && selectedReason && (
            <div className="pt-2">
              <label className="text-sm font-medium text-muted-foreground">
                Opțional: Ce ai făcut în schimb?
              </label>
              <textarea
                value={alternativeAction}
                onChange={(e) => setAlternativeAction(e.target.value)}
                placeholder="Descrie acțiunea alternativă..."
                className="w-full min-h-[60px] mt-2 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Acțiune alternativă (opțional)"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Anulează
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              (action === 'dismiss' && !selectedReason) ||
              (action === 'modify' && !alternativeAction)
            }
          >
            {loading ? 'Se trimite...' : 'Trimite Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

FeedbackDialog.displayName = 'FeedbackDialog';

/**
 * Quick feedback popover for inline dismissals
 */
export interface QuickFeedbackPopoverProps {
  suggestionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (reason: string) => void;
  position?: { x: number; y: number };
}

export function QuickFeedbackPopover({
  suggestionId,
  isOpen,
  onClose,
  onSubmit,
}: QuickFeedbackPopoverProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const { recordFeedback } = useRecordFeedback();

  if (!isOpen) return null;

  const handleSelect = async (reasonId: string) => {
    setSelectedReason(reasonId);
    await recordFeedback({
      suggestionId,
      action: 'dismissed',
      feedbackReason: reasonId,
    });
    onSubmit?.(reasonId);
    onClose();
  };

  return (
    <div
      className="absolute z-50 p-2 bg-white rounded-lg shadow-lg border min-w-[200px]"
      role="menu"
      aria-label="Motiv respingere"
    >
      <p className="text-xs text-muted-foreground mb-2 px-2">De ce respingi?</p>
      {dismissReasons.map((reason) => (
        <button
          key={reason.id}
          onClick={() => handleSelect(reason.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          role="menuitem"
        >
          <span>{reason.icon}</span>
          <span>{reason.label}</span>
        </button>
      ))}
      <button
        onClick={onClose}
        className="w-full text-xs text-muted-foreground mt-2 pt-2 border-t hover:text-foreground"
      >
        Fără feedback
      </button>
    </div>
  );
}

QuickFeedbackPopover.displayName = 'QuickFeedbackPopover';
