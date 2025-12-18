/**
 * Key Metrics Summary Row Component
 * Story 5.7: Platform Intelligence Dashboard - Task 10
 *
 * Displays key efficiency metrics in a summary row.
 * AC: 1 - Shows time saved, AI-assisted actions, automation triggers
 */

'use client';

import React from 'react';
import type { EfficiencyMetrics, TaskCompletionSummary, ROISummary } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface KeyMetricsSummaryRowProps {
  efficiency?: EfficiencyMetrics;
  taskCompletion?: TaskCompletionSummary;
  roi?: ROISummary;
  loading?: boolean;
  /** Communication analytics data for Platform Intelligence */
  communication?: unknown;
  /** Document quality analytics data for Platform Intelligence */
  documentQuality?: unknown;
  /** AI utilization analytics data for Platform Intelligence */
  aiUtilization?: unknown;
  /** Navigation callback for section quick links */
  onNavigate?: (section: string) => void;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  color: string;
  bgColor: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCard({ icon, label, value, subValue, trend, color, bgColor }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3 shadow-sm">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 truncate">{label}</div>
        <div className="text-xl font-bold text-gray-900 truncate">{value}</div>
        {subValue && <div className="text-xs text-gray-500 truncate">{subValue}</div>}
        {trend !== undefined && (
          <div
            className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs. perioada anterioară
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-6 bg-gray-200 rounded w-20" />
              <div className="h-2 bg-gray-200 rounded w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function KeyMetricsSummaryRow({
  efficiency,
  taskCompletion,
  roi,
  loading = false,
}: KeyMetricsSummaryRowProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Time Saved */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        label="Timp economisit"
        value={formatHours(efficiency?.totalTimeSavedHours ?? 0)}
        subValue="în această perioadă"
        color="#10B981"
        bgColor="#D1FAE5"
      />

      {/* AI-Assisted Actions */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        }
        label="Acțiuni AI"
        value={efficiency?.aiAssistedActions ?? 0}
        subValue="asistări AI"
        color="#8B5CF6"
        bgColor="#EDE9FE"
      />

      {/* Automation Triggers */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        }
        label="Automatizări"
        value={efficiency?.automationTriggers ?? 0}
        subValue="declanșări"
        color="#F59E0B"
        bgColor="#FEF3C7"
      />

      {/* Task Completion Rate */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        label="Rată finalizare"
        value={formatPercent(taskCompletion?.completionRate ?? 0)}
        subValue="sarcini finalizate"
        color="#3B82F6"
        bgColor="#DBEAFE"
      />

      {/* Deadline Adherence */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        label="Respectare termene"
        value={formatPercent(taskCompletion?.deadlineAdherence ?? 0)}
        subValue={`${taskCompletion?.overdueCount ?? 0} întârziate`}
        color="#EC4899"
        bgColor="#FCE7F3"
      />

      {/* Value Saved */}
      <MetricCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        label="Valoare economisită"
        value={formatCurrency(roi?.totalValueSaved ?? 0)}
        subValue={`${formatHours(roi?.billableHoursRecovered ?? 0)} ore facturabile`}
        color="#059669"
        bgColor="#D1FAE5"
      />
    </div>
  );
}

export default KeyMetricsSummaryRow;
