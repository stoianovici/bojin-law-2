/**
 * SnippetSuggestionPanel - AI-detected phrase suggestions
 * Story 5.6: AI Learning and Personalization (Task 27)
 * Displays suggestions with accept/dismiss actions, confidence level, and source context
 */

'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useSnippetSuggestions,
  useAcceptSnippetSuggestion,
  useDismissSnippetSuggestion,
} from '@/hooks/usePersonalSnippets';
import type { SnippetSuggestion, SnippetCategory } from '@legal-platform/types';

// Icons
const SparklesIcon = ({ className }: { className?: string }) => (
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
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

// Category styling
const CATEGORY_STYLES: Record<SnippetCategory, { color: string; label: string }> = {
  Greeting: { color: 'bg-green-100 text-green-800', label: 'Salutări' },
  Closing: { color: 'bg-blue-100 text-blue-800', label: 'Încheieri' },
  LegalPhrase: { color: 'bg-purple-100 text-purple-800', label: 'Expresii Juridice' },
  ClientResponse: { color: 'bg-orange-100 text-orange-800', label: 'Răspunsuri Client' },
  InternalNote: { color: 'bg-gray-100 text-gray-800', label: 'Note Interne' },
  Custom: { color: 'bg-yellow-100 text-yellow-800', label: 'Personalizate' },
};

export interface SnippetSuggestionPanelProps {
  className?: string;
  maxSuggestions?: number;
  onSuggestionAccepted?: () => void;
}

/**
 * Confidence indicator with visual bar
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 80
      ? 'bg-green-500'
      : percentage >= 60
        ? 'bg-yellow-500'
        : 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Încredere: ${percentage}%`}
      >
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{percentage}%</span>
    </div>
  );
}

/**
 * Single suggestion item
 */
function SuggestionItem({
  suggestion,
  onAccept,
  onCustomize,
  onDismiss,
  isProcessing,
}: {
  suggestion: SnippetSuggestion;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
  isProcessing: boolean;
}) {
  const categoryStyle = CATEGORY_STYLES[suggestion.category] || CATEGORY_STYLES.Custom;

  return (
    <div
      className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
      role="article"
      aria-label={`Sugestie: ${suggestion.suggestedTitle}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-amber-500 shrink-0" />
          <Badge className={`text-xs ${categoryStyle.color}`}>
            {categoryStyle.label}
          </Badge>
        </div>
        <ConfidenceIndicator confidence={suggestion.confidence} />
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm mb-1">{suggestion.suggestedTitle}</h4>

      {/* Suggested shortcut */}
      <p className="text-xs text-muted-foreground mb-2">
        Shortcut sugerat:{' '}
        <code className="bg-muted px-1 rounded">/{suggestion.suggestedShortcut}</code>
      </p>

      {/* Content preview */}
      <div className="p-3 rounded bg-muted/50 mb-3">
        <p className="text-sm text-foreground line-clamp-3">
          {suggestion.content}
        </p>
      </div>

      {/* Usage info */}
      <p className="text-xs text-muted-foreground mb-3">
        Detectat de {suggestion.occurrenceCount} ori în comunicările tale
      </p>

      {/* Actions */}
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="Acțiuni sugestie"
      >
        <Button
          size="sm"
          onClick={onAccept}
          disabled={isProcessing}
          className="flex-1"
        >
          <CheckIcon className="mr-1" />
          Acceptă
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCustomize}
          disabled={isProcessing}
          title="Personalizează înainte de a salva"
        >
          <EditIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Respinge sugestia"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Empty state when no suggestions available
 */
function EmptyState() {
  return (
    <div className="text-center py-8">
      <SparklesIcon className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
      <h4 className="text-sm font-medium text-foreground mb-1">
        Nicio sugestie momentan
      </h4>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        AI-ul analizează comunicările tale și va sugera snippet-uri când
        detectează fraze repetate.
      </p>
    </div>
  );
}

/**
 * Customization dialog for modifying suggestion before accepting
 */
function CustomizeDialog({
  suggestion,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  suggestion: SnippetSuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (shortcut: string, title: string) => void;
  saving: boolean;
}) {
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');

  // Reset form when suggestion changes
  React.useEffect(() => {
    if (suggestion) {
      setShortcut(suggestion.suggestedShortcut);
      setTitle(suggestion.suggestedTitle);
    }
  }, [suggestion]);

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizează Snippet</DialogTitle>
          <DialogDescription>
            Modifică shortcut-ul și titlul înainte de a salva snippet-ul.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview content */}
          <div className="p-3 rounded bg-muted/50">
            <p className="text-sm">{suggestion.content}</p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="customize-title" className="text-sm font-medium">
              Titlu
            </label>
            <Input
              id="customize-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titlul snippet-ului"
            />
          </div>

          {/* Shortcut */}
          <div className="space-y-2">
            <label htmlFor="customize-shortcut" className="text-sm font-medium">
              Shortcut
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                /
              </span>
              <Input
                id="customize-shortcut"
                value={shortcut}
                onChange={(e) =>
                  setShortcut(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))
                }
                className="pl-7"
                placeholder="shortcut"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Anulează
          </Button>
          <Button
            onClick={() => onSave(shortcut, title)}
            disabled={saving || !shortcut || !title}
          >
            {saving ? 'Se salvează...' : 'Salvează Snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SnippetSuggestionPanel displays AI-detected phrase suggestions
 * with options to accept, customize, or dismiss.
 */
export function SnippetSuggestionPanel({
  className = '',
  maxSuggestions = 5,
  onSuggestionAccepted,
}: SnippetSuggestionPanelProps) {
  const [customizeSuggestion, setCustomizeSuggestion] =
    useState<SnippetSuggestion | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const { suggestions, loading, error, refetch } = useSnippetSuggestions();
  const { acceptSuggestion, loading: accepting } = useAcceptSnippetSuggestion();
  const { dismissSuggestion, loading: dismissing } =
    useDismissSnippetSuggestion();

  const displayedSuggestions = suggestions.slice(0, maxSuggestions);

  const handleAccept = async (suggestion: SnippetSuggestion) => {
    const id = suggestion.content;
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      await acceptSuggestion(suggestion);
      onSuggestionAccepted?.();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCustomizeSave = async (shortcut: string, title: string) => {
    if (!customizeSuggestion) return;

    const id = customizeSuggestion.content;
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      await acceptSuggestion(customizeSuggestion, { shortcut, title });
      setCustomizeSuggestion(null);
      onSuggestionAccepted?.();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDismiss = async (suggestion: SnippetSuggestion) => {
    const id = suggestion.content;
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      await dismissSuggestion(suggestion.content);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SparklesIcon className="text-amber-500" />
            Sugestii AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Eroare la încărcarea sugestiilor.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => refetch()}
          >
            Încearcă din nou
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="text-amber-500" />
              <CardTitle className="text-lg">Sugestii AI</CardTitle>
              {suggestions.length > 0 && (
                <Badge variant="secondary">{suggestions.length}</Badge>
              )}
            </div>
            {suggestions.length > maxSuggestions && (
              <span className="text-xs text-muted-foreground">
                Afișate {maxSuggestions} din {suggestions.length}
              </span>
            )}
          </div>
          <CardDescription>
            Fraze detectate automat în comunicările tale
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border bg-card animate-pulse"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-4 bg-muted rounded" />
                    <div className="h-5 w-20 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                  <div className="h-16 bg-muted rounded mb-2" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : displayedSuggestions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {displayedSuggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.content}-${index}`}
                  suggestion={suggestion}
                  onAccept={() => handleAccept(suggestion)}
                  onCustomize={() => setCustomizeSuggestion(suggestion)}
                  onDismiss={() => handleDismiss(suggestion)}
                  isProcessing={
                    processingIds.has(suggestion.content) ||
                    accepting ||
                    dismissing
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customization Dialog */}
      <CustomizeDialog
        suggestion={customizeSuggestion}
        open={!!customizeSuggestion}
        onOpenChange={(open) => !open && setCustomizeSuggestion(null)}
        onSave={handleCustomizeSave}
        saving={accepting}
      />
    </>
  );
}

SnippetSuggestionPanel.displayName = 'SnippetSuggestionPanel';

/**
 * Compact version for sidebar/widget usage
 */
export function SnippetSuggestionBadge({
  onClick,
}: {
  onClick?: () => void;
}) {
  const { suggestions, loading } = useSnippetSuggestions();

  if (loading || suggestions.length === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition-colors"
      aria-label={`${suggestions.length} sugestii de snippet-uri`}
    >
      <SparklesIcon className="h-3 w-3" />
      <span>{suggestions.length} sugestii</span>
    </button>
  );
}

SnippetSuggestionBadge.displayName = 'SnippetSuggestionBadge';
