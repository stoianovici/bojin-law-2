/**
 * LearningProgressIndicator - Shows AI learning progress across categories
 * Story 5.6: AI Learning and Personalization (Task 38)
 * Circular gauge with category breakdown
 */

'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWritingStyleProfile } from '@/hooks/useWritingStyle';
import { useSnippets } from '@/hooks/usePersonalSnippets';
import { useTaskPatterns } from '@/hooks/useTaskPatterns';
import { useDocumentPreferences } from '@/hooks/useDocumentPreferences';
import { useResponsePatterns } from '@/hooks/useResponsePatterns';

// Icons
const BrainIcon = ({ className }: { className?: string }) => (
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

interface LearningProgressIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

interface CategoryProgress {
  name: string;
  label: string;
  value: number;
  maxValue: number;
  percentage: number;
  status: 'learning' | 'proficient' | 'expert';
  description: string;
}

/**
 * Circular progress gauge component
 */
function CircularGauge({
  percentage,
  size = 120,
  strokeWidth = 8,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = (pct: number): string => {
    if (pct >= 80) return 'stroke-green-500';
    if (pct >= 50) return 'stroke-yellow-500';
    if (pct >= 20) return 'stroke-orange-500';
    return 'stroke-red-500';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-500 ${getColor(percentage)}`}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{Math.round(percentage)}%</span>
        <span className="text-xs text-muted-foreground">Învățat</span>
      </div>
    </div>
  );
}

/**
 * Category progress bar
 */
function CategoryProgressBar({
  category,
}: {
  category: CategoryProgress;
}) {
  const statusColors = {
    learning: 'bg-yellow-500',
    proficient: 'bg-blue-500',
    expert: 'bg-green-500',
  };

  const statusLabels = {
    learning: 'În învățare',
    proficient: 'Competent',
    expert: 'Expert',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{category.label}</span>
        <span className="text-xs text-muted-foreground">
          {category.value} / {category.maxValue}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${statusColors[category.status]}`}
          style={{ width: `${category.percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {category.description}
        </span>
        <span
          className={`text-xs ${
            category.status === 'expert'
              ? 'text-green-600'
              : category.status === 'proficient'
                ? 'text-blue-600'
                : 'text-yellow-600'
          }`}
        >
          {statusLabels[category.status]}
        </span>
      </div>
    </div>
  );
}

/**
 * Encouraging message based on progress
 */
function EncouragingMessage({ percentage }: { percentage: number }) {
  const getMessage = (pct: number): string => {
    if (pct >= 90) return 'Excelent! AI-ul te cunoaște foarte bine.';
    if (pct >= 70) return 'Foarte bine! AI-ul a învățat multe despre preferințele tale.';
    if (pct >= 50) return 'Progres bun! Continuă să folosești platforma.';
    if (pct >= 30) return 'AI-ul începe să te cunoască. Mai are de învățat.';
    if (pct >= 10) return 'Început promițător! Folosește platforma pentru mai multe date.';
    return 'AI-ul abia a început să învețe. Folosește platforma pentru a-l ajuta.';
  };

  return (
    <p className="text-sm text-muted-foreground text-center mt-4">
      {getMessage(percentage)}
    </p>
  );
}

/**
 * Main LearningProgressIndicator component
 */
export function LearningProgressIndicator({
  className = '',
  showDetails = true,
}: LearningProgressIndicatorProps) {
  // Fetch data from all learning sources
  const { profile: writingProfile, learningProgress: writingProgress } = useWritingStyleProfile();
  const { count: snippetCount } = useSnippets();
  const { count: patternCount, activeCount: activePatterns } = useTaskPatterns();
  const { count: docPrefCount } = useDocumentPreferences();
  const { hasPatterns: hasResponsePatterns, patterns: responsePatterns } = useResponsePatterns();

  // Calculate category progress
  const categories = useMemo((): CategoryProgress[] => {
    const getStatus = (pct: number): 'learning' | 'proficient' | 'expert' => {
      if (pct >= 80) return 'expert';
      if (pct >= 40) return 'proficient';
      return 'learning';
    };

    // Writing style: target 50 samples
    const writingSamples = writingProfile?.sampleCount || 0;
    const writingPct = Math.min(100, (writingSamples / 50) * 100);

    // Snippets: target 10 snippets
    const snippetPct = Math.min(100, (snippetCount / 10) * 100);

    // Task patterns: target 5 patterns
    const patternPct = Math.min(100, (activePatterns / 5) * 100);

    // Document preferences: target 3 types configured
    const docPrefPct = Math.min(100, (docPrefCount / 3) * 100);

    // Response patterns: target 10 patterns
    const responsePct = hasResponsePatterns
      ? Math.min(100, (responsePatterns.length / 10) * 100)
      : 0;

    return [
      {
        name: 'writingStyle',
        label: 'Stil de scriere',
        value: writingSamples,
        maxValue: 50,
        percentage: writingPct,
        status: getStatus(writingPct),
        description: 'Analizat din editările tale',
      },
      {
        name: 'snippets',
        label: 'Snippet-uri personale',
        value: snippetCount,
        maxValue: 10,
        percentage: snippetPct,
        status: getStatus(snippetPct),
        description: 'Fraze și expresii salvate',
      },
      {
        name: 'taskPatterns',
        label: 'Pattern-uri task',
        value: activePatterns,
        maxValue: 5,
        percentage: patternPct,
        status: getStatus(patternPct),
        description: 'Obiceiuri de creare task-uri',
      },
      {
        name: 'documentPreferences',
        label: 'Preferințe documente',
        value: docPrefCount,
        maxValue: 3,
        percentage: docPrefPct,
        status: getStatus(docPrefPct),
        description: 'Tipuri de documente configurate',
      },
      {
        name: 'responsePatterns',
        label: 'Pattern-uri răspuns',
        value: responsePatterns.length,
        maxValue: 10,
        percentage: responsePct,
        status: getStatus(responsePct),
        description: 'Timpuri de răspuns analizate',
      },
    ];
  }, [
    writingProfile,
    snippetCount,
    activePatterns,
    docPrefCount,
    hasResponsePatterns,
    responsePatterns,
  ]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const total = categories.reduce((sum, cat) => sum + cat.percentage, 0);
    return Math.round(total / categories.length);
  }, [categories]);

  // Count expert categories
  const expertCount = categories.filter((c) => c.status === 'expert').length;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BrainIcon className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Progres AI</CardTitle>
            <p className="text-sm text-muted-foreground">
              {expertCount} din {categories.length} categorii expert
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center">
          {/* Circular gauge */}
          <CircularGauge percentage={overallProgress} size={140} strokeWidth={10} />

          {/* Encouraging message */}
          <EncouragingMessage percentage={overallProgress} />
        </div>

        {/* Category breakdown */}
        {showDetails && (
          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              Detalii pe categorii
            </h4>
            {categories.map((category) => (
              <CategoryProgressBar key={category.name} category={category} />
            ))}
          </div>
        )}

        {/* Accessibility summary */}
        <div className="sr-only">
          <h3>Sumar progres învățare AI</h3>
          <p>Progres general: {overallProgress}%</p>
          <ul>
            {categories.map((cat) => (
              <li key={cat.name}>
                {cat.label}: {cat.percentage}% - {cat.description}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

LearningProgressIndicator.displayName = 'LearningProgressIndicator';

/**
 * Compact badge version for headers/sidebars
 */
export function LearningProgressBadge({ className = '' }: { className?: string }) {
  const { learningProgress } = useWritingStyleProfile();
  const { count: snippetCount } = useSnippets();
  const { activeCount: activePatterns } = useTaskPatterns();

  // Simple overall score
  const score = useMemo(() => {
    const writingScore = Math.min(100, learningProgress);
    const snippetScore = Math.min(100, (snippetCount / 10) * 100);
    const patternScore = Math.min(100, (activePatterns / 5) * 100);
    return Math.round((writingScore + snippetScore + patternScore) / 3);
  }, [learningProgress, snippetCount, activePatterns]);

  const getColor = (s: number): string => {
    if (s >= 70) return 'bg-green-100 text-green-700 border-green-200';
    if (s >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border
        ${getColor(score)} ${className}
      `}
      title={`AI Learning: ${score}%`}
    >
      <BrainIcon className="h-3 w-3" />
      {score}%
    </div>
  );
}

LearningProgressBadge.displayName = 'LearningProgressBadge';

/**
 * Mini widget for sidebar
 */
export function LearningProgressMini({ className = '' }: { className?: string }) {
  const { learningProgress } = useWritingStyleProfile();
  const { count: snippetCount } = useSnippets();
  const { activeCount: activePatterns } = useTaskPatterns();
  const { count: docPrefCount } = useDocumentPreferences();

  const milestones = useMemo(() => {
    const items = [];
    if (learningProgress >= 50) items.push('Stil scriere');
    if (snippetCount >= 5) items.push('Snippet-uri');
    if (activePatterns >= 3) items.push('Pattern-uri');
    if (docPrefCount >= 2) items.push('Documente');
    return items;
  }, [learningProgress, snippetCount, activePatterns, docPrefCount]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <BrainIcon className="h-4 w-4 text-primary" />
        <span>AI Learning</span>
      </div>
      {milestones.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {milestones.map((milestone) => (
            <span
              key={milestone}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded"
            >
              <CheckIcon className="h-3 w-3" />
              {milestone}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Începe să folosești platforma pentru a activa AI learning
        </p>
      )}
    </div>
  );
}

LearningProgressMini.displayName = 'LearningProgressMini';
