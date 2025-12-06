/**
 * Response Time Analytics Panel Component
 * Story 5.7: Platform Intelligence Dashboard - Task 11
 *
 * Displays email response time analytics with breakdown by recipient type.
 * AC: 2 - Communication response time analytics
 */

'use client';

import React from 'react';
import type { CommunicationAnalytics } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface ResponseTimeAnalyticsPanelProps {
  data?: CommunicationAnalytics;
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function getRecipientTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    client: 'Clienți',
    opposing_counsel: 'Avocați adversi',
    court: 'Instanțe',
    internal: 'Intern',
    CLIENT: 'Clienți',
    OPPOSING_COUNSEL: 'Avocați adversi',
    COURT: 'Instanțe',
    INTERNAL: 'Intern',
  };
  return labels[type] || type;
}

function getRecipientTypeColor(type: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    client: { bg: '#DBEAFE', text: '#1D4ED8' },
    opposing_counsel: { bg: '#FEE2E2', text: '#DC2626' },
    court: { bg: '#FEF3C7', text: '#D97706' },
    internal: { bg: '#E0E7FF', text: '#4F46E5' },
    CLIENT: { bg: '#DBEAFE', text: '#1D4ED8' },
    OPPOSING_COUNSEL: { bg: '#FEE2E2', text: '#DC2626' },
    COURT: { bg: '#FEF3C7', text: '#D97706' },
    INTERNAL: { bg: '#E0E7FF', text: '#4F46E5' },
  };
  return colors[type] || { bg: '#F3F4F6', text: '#6B7280' };
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResponseTimeAnalyticsPanel({
  data,
  loading = false,
}: ResponseTimeAnalyticsPanelProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        Nu există date de comunicare disponibile
      </div>
    );
  }

  const { currentResponseTime, baselineComparison, byRecipientType } = data;
  const improvement = baselineComparison?.improvementPercent ?? 0;
  const isImproved = improvement > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Analiză timp de răspuns</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {currentResponseTime.totalEmailsAnalyzed.toLocaleString()} emailuri analizate
          </span>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Average Response Time */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Medie</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatHours(currentResponseTime.avgResponseTimeHours)}
          </div>
          {baselineComparison && (
            <div
              className={`text-xs font-medium ${
                isImproved ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {isImproved ? '↓' : '↑'} {Math.abs(improvement).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Median Response Time */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Mediană</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatHours(currentResponseTime.medianResponseTimeHours)}
          </div>
        </div>

        {/* P90 Response Time */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">P90</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatHours(currentResponseTime.p90ResponseTimeHours)}
          </div>
          <div className="text-xs text-gray-400">90% sub această valoare</div>
        </div>

        {/* Within SLA */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">În SLA (24h)</div>
          <div className="text-2xl font-bold text-emerald-600">
            {currentResponseTime.withinSLAPercent.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">
            răspuns în max 24 ore
          </div>
        </div>

        {/* Total Analyzed */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Total analizat</div>
          <div className="text-2xl font-bold text-gray-900">
            {currentResponseTime.totalEmailsAnalyzed.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">emailuri cu răspuns</div>
        </div>
      </div>

      {/* By Recipient Type */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Timp răspuns pe tip destinatar</h4>
        {byRecipientType.map((item) => {
          const colors = getRecipientTypeColor(item.emailType);
          const slaPercent = item.metrics.withinSLAPercent;
          const isGoodSLA = slaPercent >= 80;

          return (
            <div
              key={item.emailType}
              className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
            >
              {/* Type Label */}
              <div
                className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {getRecipientTypeLabel(item.emailType)}
              </div>

              {/* Metrics */}
              <div className="flex-1 grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Medie</div>
                  <div className="font-semibold text-gray-900">
                    {formatHours(item.metrics.avgResponseTimeHours)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Mediană</div>
                  <div className="font-semibold text-gray-900">
                    {formatHours(item.metrics.medianResponseTimeHours)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">În SLA</div>
                  <div
                    className={`font-semibold ${
                      isGoodSLA ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {slaPercent.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Volum</div>
                  <div className="font-semibold text-gray-900">
                    {item.volumeCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* SLA Progress Bar */}
              <div className="w-32">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isGoodSLA ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(slaPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Baseline Comparison */}
      {baselineComparison && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Comparație cu perioada de bază
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                isImproved
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isImproved ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              )}
              <span>
                {isImproved ? 'Îmbunătățire' : 'Regres'}: {Math.abs(improvement).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Perioada anterioară</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatHours(baselineComparison.baselinePeriod.avgResponseTimeHours)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Perioada curentă</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatHours(baselineComparison.currentPeriod.avgResponseTimeHours)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponseTimeAnalyticsPanel;
