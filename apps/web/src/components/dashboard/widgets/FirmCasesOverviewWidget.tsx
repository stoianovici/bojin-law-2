/**
 * FirmCasesOverviewWidget - Partner Dashboard Firm Cases Overview
 * Displays at-risk cases, high-value cases, and AI insights with tabbed interface
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { FirmCasesOverviewWidget as FirmCasesOverviewWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import * as Tabs from '@radix-ui/react-tabs';

export interface FirmCasesOverviewWidgetProps {
  widget: FirmCasesOverviewWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Summary Badge Component
 */
function SummaryBadge({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: 'red' | 'gold' | 'blue';
}) {
  const colorClasses = {
    red: 'bg-red-100 text-red-700 border-red-300',
    gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  return (
    <div className="flex flex-col items-center p-3 border rounded-lg" title={label}>
      <span className={clsx('text-2xl font-bold', color === 'red' ? 'text-red-600' : color === 'gold' ? 'text-yellow-600' : 'text-blue-600')}>
        {count}
      </span>
      <span className="text-xs text-gray-600 mt-1 text-center">{label}</span>
    </div>
  );
}

/**
 * At-Risk Case Item Component
 */
function AtRiskCaseItem({
  caseItem,
  onClick,
}: {
  caseItem: FirmCasesOverviewWidgetType['atRiskCases'][0];
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Caz cu risc: ${caseItem.caseNumber}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {caseItem.caseNumber}
            </button>
            {caseItem.daysUntilDeadline !== undefined && caseItem.daysUntilDeadline <= 3 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {caseItem.daysUntilDeadline === 0 ? 'Astăzi' : `${caseItem.daysUntilDeadline} zile`}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1" title={caseItem.title}>
            {caseItem.title}
          </h4>
          <p className="text-xs text-red-600 mb-1">{caseItem.reason}</p>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{caseItem.assignedPartner}</span>
          </div>
        </div>
        <button
          className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            // Handle review action
            onClick();
          }}
        >
          Revizuiește
        </button>
      </div>
    </div>
  );
}

/**
 * High-Value Case Item Component
 */
function HighValueCaseItem({
  caseItem,
  onClick,
}: {
  caseItem: FirmCasesOverviewWidgetType['highValueCases'][0];
  onClick: () => void;
}) {
  const priorityConfig = {
    strategic: { label: 'Strategic', className: 'bg-purple-100 text-purple-700' },
    vip: { label: 'VIP', className: 'bg-yellow-100 text-yellow-700' },
    highValue: { label: 'Valoare Mare', className: 'bg-green-100 text-green-700' },
  };

  const config = priorityConfig[caseItem.priority];

  return (
    <div
      onClick={onClick}
      className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Caz cu valoare mare: ${caseItem.caseNumber}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {caseItem.caseNumber}
            </button>
            <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', config.className)}>
              {config.label}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1" title={caseItem.title}>
            {caseItem.title}
          </h4>
          <p className="text-xs text-green-600 font-medium mb-1">
            Valoare: €{caseItem.value.toLocaleString('ro-RO')}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{caseItem.assignedPartner}</span>
          </div>
        </div>
        <button
          className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          Vezi
        </button>
      </div>
    </div>
  );
}

/**
 * AI Insight Item Component
 */
function AIInsightItem({
  insight,
  onClick,
}: {
  insight: FirmCasesOverviewWidgetType['aiInsights'][0];
  onClick: () => void;
}) {
  const typeConfig = {
    pattern: {
      label: 'Pattern Detectat',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.5 3A6.5 6.5 0 0116 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 019.5 16 6.5 6.5 0 013 9.5 6.5 6.5 0 019.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" />
        </svg>
      ),
      className: 'bg-blue-100 text-blue-700',
    },
    bottleneck: {
      label: 'Blocaj',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      ),
      className: 'bg-orange-100 text-orange-700',
    },
    opportunity: {
      label: 'Oportunitate',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      className: 'bg-green-100 text-green-700',
    },
  };

  const config = typeConfig[insight.type];
  const timeAgo = new Date(insight.timestamp).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Insight AI pentru caz ${insight.caseNumber}`}
    >
      <div className="flex items-start gap-3">
        <div className={clsx('p-2 rounded', config.className)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {insight.caseNumber}
            </button>
            <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', config.className)}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-gray-900 mb-1">{insight.message}</p>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * FirmCasesOverviewWidget - Displays firm-wide case insights with tabs
 *
 * Shows at-risk cases, high-value cases, and AI insights in a tabbed interface.
 * Uses Radix UI Tabs for accessible tab navigation.
 */
export function FirmCasesOverviewWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: FirmCasesOverviewWidgetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'atRisk' | 'highValue' | 'aiInsights'>('atRisk');

  const totalActiveCases =
    (widget.atRiskCases?.length || 0) + (widget.highValueCases?.length || 0);

  const handleCaseClick = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <SummaryBadge
          count={widget.atRiskCases?.length || 0}
          label="Cazuri cu Risc"
          color="red"
        />
        <SummaryBadge
          count={widget.highValueCases?.length || 0}
          label="Valoare Mare"
          color="gold"
        />
        <SummaryBadge
          count={widget.aiInsights?.length || 0}
          label="Insights AI"
          color="blue"
        />
      </div>

      {/* Tabbed Interface */}
      <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <Tabs.List className="flex border-b border-gray-200 mb-3">
          <Tabs.Trigger
            value="atRisk"
            className={clsx(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t',
              activeTab === 'atRisk'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            Cu Risc ({widget.atRiskCases?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="highValue"
            className={clsx(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t',
              activeTab === 'highValue'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            Valoare Mare ({widget.highValueCases?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="aiInsights"
            className={clsx(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t',
              activeTab === 'aiInsights'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            AI Insights ({widget.aiInsights?.length || 0})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="atRisk" className="focus:outline-none">
          {!widget.atRiskCases || widget.atRiskCases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">Nu există cazuri cu risc</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {widget.atRiskCases.map((caseItem) => (
                <AtRiskCaseItem
                  key={caseItem.id}
                  caseItem={caseItem}
                  onClick={() => handleCaseClick(caseItem.id)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="highValue" className="focus:outline-none">
          {!widget.highValueCases || widget.highValueCases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">Nu există cazuri cu valoare mare</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {widget.highValueCases.map((caseItem) => (
                <HighValueCaseItem
                  key={caseItem.id}
                  caseItem={caseItem}
                  onClick={() => handleCaseClick(caseItem.id)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="aiInsights" className="focus:outline-none">
          {!widget.aiInsights || widget.aiInsights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">Nu există insights AI noi</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {widget.aiInsights.map((insight) => (
                <AIInsightItem
                  key={insight.id}
                  insight={insight}
                  onClick={() => handleCaseClick(insight.caseId)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </WidgetContainer>
  );
}

FirmCasesOverviewWidget.displayName = 'FirmCasesOverviewWidget';
