'use client';

/**
 * Intelligence Tab Component
 * Story 5.2: Communication Intelligence Engine - Task 21
 *
 * Displays AI-powered intelligence for a case including:
 * - Intelligence summary widget
 * - Extracted items panel (deadlines, commitments, action items)
 * - Risk indicators panel
 * - Calendar suggestions
 * - Thread summaries for case emails
 */

import { useState } from 'react';
import {
  Brain,
  AlertTriangle,
  Calendar,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { ExtractedItemsPanel } from '../../communication/ExtractedItemsPanel';
import { RiskIndicatorsPanel } from '../RiskIndicatorsPanel';
import { RiskAlertBanner } from '../RiskAlertBanner';
import { CalendarSuggestions } from '../../communication/CalendarSuggestions';
import { CaseThreadSummariesPanel } from '../../communication/ThreadSummaryPanel';
import {
  useExtractedItemsCounts,
  useCaseThreadSummaries,
} from '../../../hooks/useExtractedItems';
import { useRiskIndicators } from '../../../hooks/useRiskIndicators';

// ============================================================================
// Types
// ============================================================================

interface IntelligenceTabProps {
  caseId: string;
}

// ============================================================================
// Intelligence Summary Widget
// ============================================================================

interface IntelligenceSummaryProps {
  caseId: string;
}

function IntelligenceSummary({ caseId }: IntelligenceSummaryProps) {
  const { data: itemsData, loading: itemsLoading } = useExtractedItemsCounts(caseId);
  const { riskSummary, loading: risksLoading } = useRiskIndicators({ caseId });

  const loading = itemsLoading || risksLoading;
  const counts = itemsData?.extractedItemsCounts;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Pending Items */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Pending Items</div>
        <div className="text-2xl font-bold text-gray-900">
          {counts?.total ?? 0}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {counts?.deadlines ?? 0} deadlines, {counts?.actionItems ?? 0} actions
        </div>
      </div>

      {/* Commitments */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Commitments</div>
        <div className="text-2xl font-bold text-blue-600">
          {counts?.commitments ?? 0}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Tracked from emails
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Unanswered Questions</div>
        <div className="text-2xl font-bold text-purple-600">
          {counts?.questions ?? 0}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Requiring response
        </div>
      </div>

      {/* Active Risks */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Active Risks</div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">
            {riskSummary?.unresolvedCount ?? 0}
          </span>
          {(riskSummary?.highSeverityCount ?? 0) > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              {riskSummary?.highSeverityCount} high
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {riskSummary?.mediumSeverityCount ?? 0} medium, {riskSummary?.lowSeverityCount ?? 0} low
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, icon, badge, children, defaultExpanded = true }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-900">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Intelligence Tab Component
// ============================================================================

export function IntelligenceTab({ caseId }: IntelligenceTabProps) {
  const { data: itemsData } = useExtractedItemsCounts(caseId);
  const { data: threadsData } = useCaseThreadSummaries(caseId);
  const { riskSummary, highSeverityRisks } = useRiskIndicators({ caseId });

  const handleAddToCalendar = (item: { id: string; dueDate: string; description: string }) => {
    // This would open a calendar modal or redirect
    console.log('Add to calendar:', item);
  };

  const handleEmailClick = (emailId: string) => {
    // Navigate to email view
    window.location.href = `/emails?id=${emailId}`;
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-600" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900">Case Intelligence</h2>
        </div>
        <button
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Refresh intelligence data"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Risk Alert Banner for high-severity risks */}
      {highSeverityRisks && highSeverityRisks.length > 0 && (
        <RiskAlertBanner caseId={caseId} />
      )}

      {/* Intelligence Summary */}
      <IntelligenceSummary caseId={caseId} />

      {/* Two-column layout for main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Extracted Items */}
          <Section
            title="Extracted Items"
            icon={<Brain className="h-5 w-5 text-blue-500" aria-hidden="true" />}
            badge={itemsData?.extractedItemsCounts?.total}
          >
            <ExtractedItemsPanel
              caseId={caseId}
              onAddToCalendar={handleAddToCalendar}
            />
          </Section>

          {/* Calendar Suggestions */}
          <Section
            title="Calendar Suggestions"
            icon={<Calendar className="h-5 w-5 text-green-500" aria-hidden="true" />}
            defaultExpanded={false}
          >
            <CalendarSuggestions caseId={caseId} />
          </Section>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Risk Indicators */}
          <Section
            title="Risk Indicators"
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />}
            badge={riskSummary?.unresolvedCount}
          >
            <RiskIndicatorsPanel caseId={caseId} />
          </Section>

          {/* Thread Analyses */}
          <Section
            title="Thread Analyses"
            icon={<MessageSquare className="h-5 w-5 text-purple-500" aria-hidden="true" />}
            badge={threadsData?.caseThreadSummaries?.length}
            defaultExpanded={false}
          >
            <CaseThreadSummariesPanel
              caseId={caseId}
              onEmailClick={handleEmailClick}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

export default IntelligenceTab;
