/**
 * CaseAISummarySection Component
 * OPS-050: Overview Tab AI Summary UI
 *
 * Displays cached AI-generated case summary with key developments and open issues
 */

'use client';

import React from 'react';
import {
  Brain,
  Loader2,
  FileText,
  Mail,
  MessageSquare,
  CheckSquare,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import { useCaseSummary } from '../../hooks/useCaseSummary';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// Types
// ============================================================================

interface CaseAISummarySectionProps {
  caseId: string;
  className?: string;
}

// ============================================================================
// Skeleton Component
// ============================================================================

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      {/* Executive Summary Card Skeleton */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-5">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="bg-linear-bg-tertiary rounded-lg p-3">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>

      {/* 2-Column Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-5">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-5">
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center mb-4">
          <Brain className="h-6 w-6 text-purple-500" />
        </div>
        <h3 className="text-base font-medium text-linear-text-primary mb-2">Rezumat AI în pregătire</h3>
        <p className="text-sm text-linear-text-tertiary max-w-md">
          Rezumatul automat va fi generat în curând. Acesta analizează toate comunicările,
          documentele și sarcinile pentru a oferi o imagine de ansamblu a cazului.
        </p>
        <div className="flex items-center gap-2 mt-4 text-xs text-linear-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Se procesează...</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Key Developments Card Component
// ============================================================================

interface KeyDevelopmentsCardProps {
  developments: string[];
}

function KeyDevelopmentsCard({ developments }: KeyDevelopmentsCardProps) {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle">
      <div className="px-5 py-4 border-b border-linear-border-subtle flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-linear-warning" />
        <h3 className="font-semibold text-linear-text-primary">Dezvoltări Cheie</h3>
      </div>
      <div className="p-5">
        {developments.length > 0 ? (
          <ul className="space-y-2">
            {developments.map((development, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-linear-text-secondary">
                <span className="text-linear-warning mt-0.5">→</span>
                <span>{development}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-linear-text-tertiary italic">Nu există dezvoltări cheie înregistrate</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Open Issues Card Component
// ============================================================================

interface OpenIssuesCardProps {
  issues: string[];
}

function OpenIssuesCard({ issues }: OpenIssuesCardProps) {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle">
      <div className="px-5 py-4 border-b border-linear-border-subtle flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-linear-error" />
        <h3 className="font-semibold text-linear-text-primary">Probleme Nerezolvate</h3>
      </div>
      <div className="p-5">
        {issues.length > 0 ? (
          <ul className="space-y-2">
            {issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-linear-text-secondary">
                <span className="text-linear-error mt-0.5">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-linear-text-tertiary italic">Nu există probleme nerezolvate</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Data Stats Component
// ============================================================================

interface DataStatsProps {
  emailCount: number;
  documentCount: number;
  noteCount: number;
  taskCount: number;
}

function DataStats({ emailCount, documentCount, noteCount, taskCount }: DataStatsProps) {
  const stats = [
    { icon: Mail, count: emailCount, label: 'Emailuri' },
    { icon: FileText, count: documentCount, label: 'Documente' },
    { icon: MessageSquare, count: noteCount, label: 'Note' },
    { icon: CheckSquare, count: taskCount, label: 'Sarcini' },
  ];

  return (
    <div className="flex items-center gap-4 text-xs text-linear-text-tertiary">
      {stats.map(({ icon: Icon, count, label }) => (
        <div key={label} className="flex items-center gap-1">
          <Icon className="h-3 w-3" />
          <span>
            {count} {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseAISummarySection({ caseId, className }: CaseAISummarySectionProps) {
  const { summary, loading } = useCaseSummary(caseId);

  if (loading && !summary) {
    return <SummarySkeleton />;
  }

  if (!summary) {
    return <EmptyState />;
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Executive Summary Card */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-linear-text-primary">Rezumat AI</h3>
          </div>
          <div className="flex items-center gap-3">
            {summary.isStale && (
              <span className="flex items-center gap-1 text-xs text-linear-warning">
                <Loader2 className="h-3 w-3 animate-spin" />
                Actualizare în curs...
              </span>
            )}
            <span className="text-xs text-linear-text-tertiary">
              Actualizat{' '}
              {formatDistanceToNow(new Date(summary.generatedAt), {
                addSuffix: true,
                locale: ro,
              })}
            </span>
          </div>
        </div>

        <p className="text-linear-text-secondary mb-4">{summary.executiveSummary}</p>

        <div className="bg-linear-accent/10 rounded-lg p-3 border border-linear-accent/20 mb-4">
          <h4 className="text-sm font-medium text-linear-accent mb-1">Status Curent</h4>
          <p className="text-sm text-linear-accent/90">{summary.currentStatus}</p>
        </div>

        <DataStats
          emailCount={summary.emailCount}
          documentCount={summary.documentCount}
          noteCount={summary.noteCount}
          taskCount={summary.taskCount}
        />
      </div>

      {/* 2-Column: Key Developments + Open Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KeyDevelopmentsCard developments={summary.keyDevelopments} />
        <OpenIssuesCard issues={summary.openIssues} />
      </div>
    </div>
  );
}

CaseAISummarySection.displayName = 'CaseAISummarySection';
