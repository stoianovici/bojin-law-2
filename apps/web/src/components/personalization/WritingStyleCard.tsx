/**
 * WritingStyleCard - Display user's learned writing style
 * Story 5.6: AI Learning and Personalization (Task 23)
 * Shows formality meter, preferred tone, sample count, and top phrases
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWritingStyle } from '@/hooks/useWritingStyle';

// Icons
const PenIcon = ({ className }: { className?: string }) => (
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
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
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
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

export interface WritingStyleCardProps {
  className?: string;
  showResetButton?: boolean;
}

/**
 * Progress bar component for formality/complexity meters
 */
function ProgressMeter({
  value,
  label,
  colorClass,
  ariaLabel,
}: {
  value: number;
  label: string;
  colorClass: string;
  ariaLabel: string;
}) {
  const percentage = Math.round(value * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div
        className="h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Empty state when no writing style has been learned yet
 */
function EmptyState() {
  return (
    <div className="text-center py-6">
      <PenIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h4 className="mt-4 text-sm font-medium text-foreground">
        Nicio preferință învățată
      </h4>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
        Editează draft-uri generate de AI pentru ca sistemul să învețe stilul
        tău de scriere.
      </p>
    </div>
  );
}

/**
 * Loading skeleton for the card
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-2 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-2 bg-muted rounded w-full" />
      <div className="flex gap-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-muted rounded w-20" />
        ))}
      </div>
    </div>
  );
}

/**
 * WritingStyleCard displays the user's learned writing style profile
 * with visual indicators for formality, complexity, and common phrases.
 */
export function WritingStyleCard({
  className = '',
  showResetButton = true,
}: WritingStyleCardProps) {
  const [showResetDialog, setShowResetDialog] = useState(false);

  const {
    profile,
    loading,
    error,
    hasProfile,
    learningProgress,
    isLearning,
    analyzeWritingStyle,
    resetWritingStyle,
    analyzing,
    resetting,
    formalityLabel,
    complexityLabel,
  } = useWritingStyle();

  const handleReset = async () => {
    await resetWritingStyle();
    setShowResetDialog(false);
  };

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PenIcon className="text-primary" />
            Stil de Scriere
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Eroare la încărcarea profilului de scriere.
          </p>
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
              <PenIcon className="text-primary" />
              <CardTitle className="text-lg">Stil de Scriere</CardTitle>
            </div>
            {hasProfile && (
              <Badge variant={isLearning ? 'outline' : 'default'}>
                {isLearning
                  ? `Învățare ${learningProgress}%`
                  : 'Profil Complet'}
              </Badge>
            )}
          </div>
          <CardDescription>
            Stilul tău de scriere învățat din editările la draft-uri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton />
          ) : !hasProfile ? (
            <EmptyState />
          ) : (
            <div className="space-y-5">
              {/* Formality Level */}
              <ProgressMeter
                value={profile!.formalityLevel}
                label="Nivel de Formalitate"
                colorClass="bg-blue-500"
                ariaLabel={`Nivel de formalitate: ${formalityLabel}`}
              />

              {/* Vocabulary Complexity */}
              <ProgressMeter
                value={profile!.vocabularyComplexity}
                label="Complexitate Vocabular"
                colorClass="bg-purple-500"
                ariaLabel={`Complexitate vocabular: ${complexityLabel}`}
              />

              {/* Preferred Tone */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Ton Preferat
                </span>
                <Badge variant="secondary">{profile!.preferredTone}</Badge>
              </div>

              {/* Sample Count */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Mostre Analizate
                </span>
                <span className="text-sm font-medium">
                  {profile!.sampleCount}
                </span>
              </div>

              {/* Learning Progress Bar */}
              {isLearning && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progres Învățare</span>
                    <span>{learningProgress}% complet</span>
                  </div>
                  <div
                    className="h-1.5 bg-muted rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={learningProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progres învățare stil"
                  >
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${learningProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Common Phrases */}
              {profile!.commonPhrases.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">
                    Expresii Frecvente
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[...profile!.commonPhrases]
                      .sort((a: { phrase: string; frequency: number; context: string }, b: { phrase: string; frequency: number; context: string }) => b.frequency - a.frequency)
                      .slice(0, 5)
                      .map((phrase: { phrase: string; frequency: number; context: string }, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                          title={`Folosită de ${phrase.frequency} ori în ${phrase.context}`}
                        >
                          {phrase.phrase.length > 30
                            ? `${phrase.phrase.substring(0, 30)}...`
                            : phrase.phrase}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Last Analyzed */}
              {profile!.lastAnalyzedAt && (
                <p className="text-xs text-muted-foreground">
                  Ultima analiză:{' '}
                  {new Date(profile!.lastAnalyzedAt).toLocaleDateString(
                    'ro-RO',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analyzeWritingStyle()}
                  disabled={analyzing}
                  className="flex items-center gap-1"
                >
                  <RefreshIcon
                    className={analyzing ? 'animate-spin' : undefined}
                  />
                  {analyzing ? 'Analizez...' : 'Actualizează'}
                </Button>

                {showResetButton && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowResetDialog(true)}
                    disabled={resetting}
                    className="text-destructive hover:text-destructive flex items-center gap-1"
                  >
                    <TrashIcon />
                    Resetează
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetează Stilul de Scriere</DialogTitle>
            <DialogDescription>
              Ești sigur că vrei să resetezi profilul de scriere? Toate
              preferințele învățate vor fi șterse și sistemul va trebui să
              reînvețe stilul tău de la zero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={resetting}
            >
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? 'Se resetează...' : 'Resetează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

WritingStyleCard.displayName = 'WritingStyleCard';

/**
 * Compact version of WritingStyleCard for dashboard widgets
 */
export function WritingStyleCardCompact({
  className = '',
}: {
  className?: string;
}) {
  const { profile, hasProfile, loading, formalityLabel, learningProgress } =
    useWritingStyle();

  if (loading) {
    return (
      <div
        className={`p-4 rounded-lg border bg-card ${className} animate-pulse`}
      >
        <div className="h-4 bg-muted rounded w-1/2 mb-2" />
        <div className="h-2 bg-muted rounded w-full" />
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div
        className={`p-4 rounded-lg border bg-card ${className}`}
        role="article"
        aria-label="Stil de scriere"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PenIcon className="h-4 w-4" />
          <span>Stilul de scriere încă nu a fost învățat</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg border bg-card ${className}`}
      role="article"
      aria-label="Stil de scriere"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PenIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Stil de Scriere</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {learningProgress}%
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <strong>Ton:</strong> {profile!.preferredTone}
        </span>
        <span>
          <strong>Formalitate:</strong> {formalityLabel}
        </span>
      </div>
    </div>
  );
}

WritingStyleCardCompact.displayName = 'WritingStyleCardCompact';
