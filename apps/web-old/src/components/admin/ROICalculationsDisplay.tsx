/**
 * ROI Calculations Display Component
 * Story 2.12.1 - Task 7: Admin Dashboard - ROI calculations display
 *
 * Displays ROI analysis and cost-benefit calculations for discovery and templates
 */

'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface DiscoveryStatus {
  typesDiscovered: number;
  pendingReview: number;
  templatesCreated: number;
  estimatedROI: string;
  totalDocuments: number;
  mappedToSkills: number;
  averageConfidence: number;
  documentTypes?: DocumentType[];
}

interface DocumentType {
  id: string;
  discoveredTypeOriginal: string;
  discoveredTypeNormalized: string;
  discoveredTypeEnglish: string | null;
  primaryLanguage: string;
  mappedSkillId: string | null;
  totalOccurrences: number;
  priorityScore: number;
  mappingStatus: string;
  confidence: number | null;
  estimatedTimeSavings: number;
  estimatedMonthlySavings: string;
}

interface ROIMetrics {
  totalHoursSaved: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  averageTimePerDocument: number;
  documentTypesWithTemplates: number;
  projectedPaybackMonths: number;
}

const HOURLY_RATE = 100; // €100/hour
const DEVELOPMENT_COST_PER_TEMPLATE = 500; // €500 per template

export function ROICalculationsDisplay() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/discovery/status?detailed=true&sortBy=occurrences');
      if (!response.ok) {
        throw new Error('Failed to fetch discovery status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);

      // Auto-select types with templates
      if (data.documentTypes) {
        const templatedTypes = new Set<string>(
          data.documentTypes
            .filter((t: DocumentType) => t.mappedSkillId)
            .map((t: DocumentType) => t.id)
        );
        setSelectedTypes(templatedTypes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleTypeSelection = (typeId: string) => {
    const newSelection = new Set(selectedTypes);
    if (newSelection.has(typeId)) {
      newSelection.delete(typeId);
    } else {
      newSelection.add(typeId);
    }
    setSelectedTypes(newSelection);
  };

  const calculateROI = (): ROIMetrics => {
    if (!status?.documentTypes) {
      return {
        totalHoursSaved: 0,
        totalMonthlySavings: 0,
        totalAnnualSavings: 0,
        averageTimePerDocument: 0,
        documentTypesWithTemplates: 0,
        projectedPaybackMonths: 0,
      };
    }

    const selectedDocTypes = status.documentTypes.filter((t) => selectedTypes.has(t.id));

    const totalHoursSaved = selectedDocTypes.reduce(
      (sum, type) => sum + type.estimatedTimeSavings * type.totalOccurrences,
      0
    );

    const monthlyHoursSaved = totalHoursSaved / 12; // Distribute annually over 12 months
    const totalMonthlySavings = monthlyHoursSaved * HOURLY_RATE;
    const totalAnnualSavings = totalHoursSaved * HOURLY_RATE;

    const totalDocs = selectedDocTypes.reduce((sum, type) => sum + type.totalOccurrences, 0);
    const averageTimePerDocument = totalDocs > 0 ? totalHoursSaved / totalDocs : 0;

    const documentTypesWithTemplates = selectedDocTypes.filter((t) => t.mappedSkillId).length;
    const developmentCost = documentTypesWithTemplates * DEVELOPMENT_COST_PER_TEMPLATE;
    const projectedPaybackMonths =
      totalMonthlySavings > 0 ? developmentCost / totalMonthlySavings : 0;

    return {
      totalHoursSaved,
      totalMonthlySavings,
      totalAnnualSavings,
      averageTimePerDocument,
      documentTypesWithTemplates,
      projectedPaybackMonths,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-linear-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-4">
        <p className="text-linear-error">Error: {error}</p>
        <button
          onClick={fetchStatus}
          className="mt-2 text-sm text-linear-error hover:text-linear-error underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const metrics = calculateROI();
  const documentTypes = status?.documentTypes || [];

  return (
    <div className="space-y-6">
      {/* ROI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ROICard
          label="Monthly Savings"
          value={`€${metrics.totalMonthlySavings.toFixed(0)}`}
          subtitle={`${metrics.totalHoursSaved.toFixed(0)} hours saved annually`}
          icon="💰"
          color="green"
        />
        <ROICard
          label="Annual Savings"
          value={`€${metrics.totalAnnualSavings.toFixed(0)}`}
          subtitle={`Based on €${HOURLY_RATE}/hour rate`}
          icon="📈"
          color="blue"
        />
        <ROICard
          label="Payback Period"
          value={`${metrics.projectedPaybackMonths.toFixed(1)} months`}
          subtitle={`For ${metrics.documentTypesWithTemplates} templates`}
          icon="⏱️"
          color="purple"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
          <div className="text-sm font-medium text-linear-text-secondary mb-2">
            Average Time Saved per Document
          </div>
          <div className="text-3xl font-bold text-linear-text-primary">
            {metrics.averageTimePerDocument.toFixed(1)} hours
          </div>
          <div className="mt-2 text-sm text-linear-text-secondary">
            Across {selectedTypes.size} selected document types
          </div>
        </div>

        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
          <div className="text-sm font-medium text-linear-text-secondary mb-2">
            Cost-Benefit Ratio
          </div>
          <div className="text-3xl font-bold text-linear-text-primary">
            {metrics.documentTypesWithTemplates > 0
              ? `${(
                  metrics.totalAnnualSavings /
                  (metrics.documentTypesWithTemplates * DEVELOPMENT_COST_PER_TEMPLATE)
                ).toFixed(1)}x`
              : 'N/A'}
          </div>
          <div className="mt-2 text-sm text-linear-text-secondary">
            Return on investment multiplier
          </div>
        </div>
      </div>

      {/* Document Type Selection */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-linear-text-primary">
            Document Types ({selectedTypes.size} selected)
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTypes(new Set(documentTypes.map((t) => t.id)))}
              className="px-3 py-1 text-sm text-linear-accent hover:text-linear-accent-hover font-medium"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedTypes(new Set())}
              className="px-3 py-1 text-sm text-linear-text-secondary hover:text-linear-text-primary font-medium"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-linear-border-subtle">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedTypes.size === documentTypes.length && documentTypes.length > 0
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTypes(new Set(documentTypes.map((t) => t.id)));
                      } else {
                        setSelectedTypes(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Document Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Occurrences
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Time Saved/Doc
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Monthly Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
              {documentTypes.map((type) => {
                const totalHours = type.estimatedTimeSavings * type.totalOccurrences;
                const monthlyValue = (totalHours * HOURLY_RATE) / 12;

                return (
                  <tr
                    key={type.id}
                    className={clsx(
                      'hover:bg-linear-bg-hover cursor-pointer',
                      selectedTypes.has(type.id) && 'bg-linear-accent/10'
                    )}
                    onClick={() => toggleTypeSelection(type.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.has(type.id)}
                        onChange={() => toggleTypeSelection(type.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-linear-text-primary">
                        {type.discoveredTypeOriginal}
                      </div>
                      {type.discoveredTypeEnglish && (
                        <div className="text-xs text-linear-text-tertiary">
                          {type.discoveredTypeEnglish}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-primary">
                      {type.totalOccurrences}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-primary">
                      {type.estimatedTimeSavings.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-primary">
                      {totalHours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-linear-success">
                      €{monthlyValue.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {type.mappedSkillId ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-linear-success/15 text-linear-success">
                          Template
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-linear-bg-tertiary text-linear-text-secondary">
                          No Template
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROI Projection Chart Placeholder */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h2 className="text-lg font-semibold text-linear-text-primary mb-4">ROI Projection</h2>
        <div className="space-y-4">
          {/* Development Cost */}
          <div className="flex items-center justify-between p-4 bg-linear-error/10 rounded-lg">
            <div>
              <div className="font-medium text-linear-text-primary">Development Cost</div>
              <div className="text-sm text-linear-text-secondary">
                One-time investment for templates
              </div>
            </div>
            <div className="text-2xl font-bold text-linear-error">
              -€{(metrics.documentTypesWithTemplates * DEVELOPMENT_COST_PER_TEMPLATE).toFixed(0)}
            </div>
          </div>

          {/* Monthly Savings Bars */}
          {[1, 3, 6, 12].map((months) => {
            const savings = metrics.totalMonthlySavings * months;
            const cost = metrics.documentTypesWithTemplates * DEVELOPMENT_COST_PER_TEMPLATE;
            const netValue = savings - cost;
            const isPositive = netValue >= 0;

            return (
              <div
                key={months}
                className="flex items-center justify-between p-4 bg-linear-bg-tertiary rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-linear-text-primary">
                    After {months} month{months > 1 ? 's' : ''}
                  </div>
                  <div className="mt-2 w-full bg-linear-bg-hover rounded-full h-3">
                    <div
                      className={clsx(
                        'h-3 rounded-full transition-all',
                        isPositive ? 'bg-linear-success' : 'bg-linear-warning'
                      )}
                      style={{
                        width: `${Math.min((savings / (cost * 2)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <div
                    className={clsx(
                      'text-2xl font-bold',
                      isPositive ? 'text-linear-success' : 'text-linear-warning'
                    )}
                  >
                    {isPositive ? '+' : ''}€{netValue.toFixed(0)}
                  </div>
                  <div className="text-sm text-linear-text-secondary">net value</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper Components

function ROICard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
  color: 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    green: 'bg-linear-success/10 text-linear-success border-linear-success/30',
    blue: 'bg-linear-accent/10 text-linear-accent border-linear-accent/30',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-linear-text-secondary">{label}</div>
        <div className={clsx('text-3xl p-2 rounded-lg', colorClasses[color])}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-linear-text-primary mb-2">{value}</div>
      <div className="text-sm text-linear-text-secondary">{subtitle}</div>
    </div>
  );
}
