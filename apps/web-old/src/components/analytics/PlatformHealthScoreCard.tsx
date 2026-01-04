/**
 * Platform Health Score Card Component
 * Story 5.7: Platform Intelligence Dashboard - Task 9
 *
 * Displays overall platform health score with visual gauge.
 * AC: All - Shows aggregated platform health score (0-100)
 */

'use client';

import React from 'react';

// ============================================================================
// Types
// ============================================================================

interface HealthBreakdown {
  communication?: number;
  documentQuality?: number;
  taskCompletion?: number;
  aiAdoption?: number;
  roi?: number;
}

interface PlatformHealthScoreCardProps {
  score: number;
  loading?: boolean;
  /** Optional breakdown of health score components */
  breakdown?: HealthBreakdown;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'; // emerald-500
  if (score >= 60) return '#F59E0B'; // amber-500
  if (score >= 40) return '#F97316'; // orange-500
  return '#EF4444'; // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelent';
  if (score >= 60) return 'Bun';
  if (score >= 40) return 'Mediu';
  return 'Necesită îmbunătățiri';
}

function getScoreDescription(score: number): string {
  if (score >= 80) {
    return 'Platforma funcționează la parametri optimi. Echipa utilizează eficient funcționalitățile AI.';
  }
  if (score >= 60) {
    return 'Performanță bună, dar există oportunități de îmbunătățire a adoptării AI.';
  }
  if (score >= 40) {
    return 'Performanță medie. Recomandăm revizuirea recomandărilor pentru îmbunătățire.';
  }
  return 'Performanță sub așteptări. Sunt necesare acțiuni imediate pentru îmbunătățire.';
}

// ============================================================================
// Component
// ============================================================================

export function PlatformHealthScoreCard({ score, loading = false }: PlatformHealthScoreCardProps) {
  if (loading) {
    return (
      <div className="bg-linear-bg-secondary rounded-xl border border-linear-border-subtle p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-4 bg-linear-bg-hover rounded w-32" />
            <div className="h-8 bg-linear-bg-hover rounded w-24" />
            <div className="h-3 bg-linear-bg-hover rounded w-48" />
          </div>
          <div className="w-32 h-32 bg-linear-bg-hover rounded-full" />
        </div>
      </div>
    );
  }

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const description = getScoreDescription(score);

  // SVG gauge calculations
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const rotation = -90; // Start from top

  return (
    <div className="bg-linear-bg-secondary rounded-xl border border-linear-border-subtle p-6 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Text Content */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-linear-text-tertiary">
            Scor sănătate platformă
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" style={{ color }}>
              {score}
            </span>
            <span className="text-xl text-linear-text-muted">/100</span>
          </div>
          <div
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {label}
          </div>
          <p className="text-sm text-linear-text-secondary max-w-xs mt-2">{description}</p>
        </div>

        {/* Gauge SVG */}
        <div className="relative w-32 h-32">
          <svg
            className="w-full h-full transform"
            viewBox="0 0 120 120"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* Background circle */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          {/* Center score text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold text-linear-text-primary">{score}</span>
              <span className="text-xs text-linear-text-tertiary block">puncte</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score breakdown hint */}
      <div className="mt-4 pt-4 border-t border-linear-border-subtle/50">
        <div className="flex items-center gap-4 text-xs text-linear-text-tertiary">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-linear-success" />
            <span>80-100 Excelent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-linear-warning" />
            <span>60-79 Bun</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-linear-warning" />
            <span>40-59 Mediu</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-linear-error" />
            <span>0-39 Critic</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlatformHealthScoreCard;
