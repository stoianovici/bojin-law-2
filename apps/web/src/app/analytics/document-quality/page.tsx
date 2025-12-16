/**
 * Document Quality Metrics Dashboard
 * Story 3.3: Intelligent Document Drafting
 *
 * Displays AI-generated document quality metrics
 * Features: edit percentage by type, trends, user ratings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { DocumentType, QualityMetricsSummary } from '@legal-platform/types';

// Document type labels for display
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  Contract: 'Contracte',
  Motion: 'Cereri',
  Letter: 'Scrisori',
  Memo: 'Memorandumuri',
  Pleading: 'Acțiuni',
  Other: 'Altele',
};

// Quality thresholds for color coding
const QUALITY_THRESHOLDS = {
  excellent: 15, // < 15% edit = green
  good: 25, // < 25% edit = yellow
  acceptable: 30, // < 30% edit = orange
  poor: 30, // >= 30% = red
};

// Date range options
const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Ultimele 7 zile' },
  { value: '30', label: 'Ultimele 30 zile' },
  { value: '90', label: 'Ultimele 90 zile' },
  { value: '365', label: 'Ultimul an' },
];

/**
 * Document Quality Dashboard Page
 */
export default function DocumentQualityPage() {
  // State
  const [dateRange, setDateRange] = useState('30');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityMetricsSummary | null>(null);
  const [trendData, setTrendData] = useState<
    Array<{
      date: string;
      averageEditPercentage: number;
      documentCount: number;
    }>
  >([]);

  // Load metrics on mount and when filters change
  useEffect(() => {
    loadMetrics();
  }, [dateRange, selectedDocType]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual GraphQL query
      // const { data } = await client.query({
      //   query: DOCUMENT_QUALITY_METRICS_QUERY,
      //   variables: {
      //     startDate: getStartDate(dateRange),
      //     endDate: new Date(),
      //     documentType: selectedDocType,
      //   },
      // });

      // Mock data for demo
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockMetrics: QualityMetricsSummary = {
        averageEditPercentage: 24.5,
        averageTimeToFinalize: 42,
        averageUserRating: 4.2,
        totalDocuments: 156,
        byDocumentType: [
          { documentType: 'Contract', averageEditPercentage: 22.3, documentCount: 68 },
          { documentType: 'Motion', averageEditPercentage: 28.1, documentCount: 42 },
          { documentType: 'Letter', averageEditPercentage: 18.5, documentCount: 25 },
          { documentType: 'Memo', averageEditPercentage: 31.2, documentCount: 12 },
          { documentType: 'Pleading', averageEditPercentage: 26.8, documentCount: 9 },
        ],
      };

      const mockTrend = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return {
          date: date.toISOString().split('T')[0],
          averageEditPercentage: 20 + Math.random() * 15,
          documentCount: Math.floor(Math.random() * 10) + 1,
        };
      });

      setMetrics(mockMetrics);
      setTrendData(mockTrend);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get quality color based on edit percentage
  const getQualityColor = (percentage: number): string => {
    if (percentage < QUALITY_THRESHOLDS.excellent) return 'text-green-600';
    if (percentage < QUALITY_THRESHOLDS.good) return 'text-yellow-600';
    if (percentage < QUALITY_THRESHOLDS.acceptable) return 'text-orange-500';
    return 'text-red-600';
  };

  // Get quality bar color
  const getQualityBarColor = (percentage: number): string => {
    if (percentage < QUALITY_THRESHOLDS.excellent) return 'bg-green-500';
    if (percentage < QUALITY_THRESHOLDS.good) return 'bg-yellow-500';
    if (percentage < QUALITY_THRESHOLDS.acceptable) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Get quality label
  const getQualityLabel = (percentage: number): string => {
    if (percentage < QUALITY_THRESHOLDS.excellent) return 'Excelent';
    if (percentage < QUALITY_THRESHOLDS.good) return 'Bun';
    if (percentage < QUALITY_THRESHOLDS.acceptable) return 'Acceptabil';
    return 'Necesită îmbunătățiri';
  };

  // Render star rating
  const renderStarRating = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={clsx(
              'w-5 h-5',
              i < fullStars
                ? 'text-yellow-400'
                : i === fullStars && hasHalfStar
                  ? 'text-yellow-400'
                  : 'text-gray-300'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Calitate Documente AI</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitorizare calitate documente generate cu AI
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Document Type Filter */}
            <select
              value={selectedDocType || ''}
              onChange={(e) =>
                setSelectedDocType(e.target.value ? (e.target.value as DocumentType) : null)
              }
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Toate tipurile</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadMetrics}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg
              className={clsx('w-4 h-4', isLoading && 'animate-spin')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Actualizează
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {/* Metrics Content */}
        {!isLoading && metrics && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              {/* Average Edit Percentage */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Editare Medie</h3>
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs font-medium rounded',
                      metrics.averageEditPercentage < 30
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    )}
                  >
                    {getQualityLabel(metrics.averageEditPercentage)}
                  </span>
                </div>
                <p
                  className={clsx(
                    'text-3xl font-bold',
                    getQualityColor(metrics.averageEditPercentage)
                  )}
                >
                  {metrics.averageEditPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Obiectiv: &lt; 30%</p>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      getQualityBarColor(metrics.averageEditPercentage)
                    )}
                    style={{
                      width: `${Math.min(metrics.averageEditPercentage, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Total Documents */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Documente Generate</h3>
                <p className="text-3xl font-bold text-gray-900">{metrics.totalDocuments}</p>
                <p className="text-xs text-gray-500 mt-1">în perioada selectată</p>
              </div>

              {/* Average Time to Finalize */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Timp Mediu Finalizare</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.averageTimeToFinalize}
                  <span className="text-lg font-normal text-gray-500 ml-1">min</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">de la generare la aprobare</p>
              </div>

              {/* User Rating */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Rating Utilizatori</h3>
                {renderStarRating(metrics.averageUserRating)}
                <p className="text-xs text-gray-500 mt-2">bazat pe feedback utilizatori</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Edit Percentage by Document Type */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Editare per Tip Document</h3>
                <div className="space-y-4">
                  {metrics.byDocumentType.map((item) => (
                    <div key={item.documentType}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">
                          {DOCUMENT_TYPE_LABELS[item.documentType] || item.documentType}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">{item.documentCount} doc.</span>
                          <span
                            className={clsx(
                              'text-sm font-medium',
                              getQualityColor(item.averageEditPercentage)
                            )}
                          >
                            {item.averageEditPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            getQualityBarColor(item.averageEditPercentage)
                          )}
                          style={{
                            width: `${Math.min(item.averageEditPercentage * 2, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Chart Placeholder */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Trend Calitate</h3>
                <div className="h-48 flex items-end gap-1">
                  {trendData.slice(-14).map((day, index) => {
                    const height = Math.max(10, Math.min(100, day.averageEditPercentage * 2));
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center"
                        title={`${day.date}: ${day.averageEditPercentage.toFixed(1)}%`}
                      >
                        <div
                          className={clsx(
                            'w-full rounded-t transition-all',
                            getQualityBarColor(day.averageEditPercentage)
                          )}
                          style={{ height: `${height}%` }}
                        />
                        {index % 2 === 0 && (
                          <span className="text-[9px] text-gray-400 mt-1 transform -rotate-45 origin-top-left">
                            {day.date.slice(5)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span>&lt; 15%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded" />
                    <span>15-25%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded" />
                    <span>25-30%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span>&gt; 30%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Target Indicator */}
            <div className="bg-blue-50 rounded-lg border border-blue-100 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">Obiectiv Calitate Documente</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Documentele generate cu AI trebuie să necesite mai puțin de{' '}
                    <strong>30% editare manuală</strong> în medie. Procentul actual de editare este{' '}
                    <strong className={getQualityColor(metrics.averageEditPercentage)}>
                      {metrics.averageEditPercentage.toFixed(1)}%
                    </strong>
                    {metrics.averageEditPercentage < 30
                      ? ' - obiectiv atins!'
                      : ' - necesită îmbunătățiri.'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
