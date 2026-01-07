'use client';

import { useState, useMemo } from 'react';
import type { ReportCategory } from '@legal-platform/types';
import { usePredefinedReports, type PredefinedReport } from '../../hooks/useReportData';
import { useReportsStore } from '../../stores/reports.store';
import { ReportBuilder } from './ReportBuilder';
import { Skeleton } from '../ui/skeleton';

const CATEGORY_INFO: Record<ReportCategory, { nameRo: string; icon: string; color: string }> = {
  cases: {
    nameRo: 'Dosare',
    icon: '📁',
    color: 'text-blue-600',
  },
  time: {
    nameRo: 'Pontaj',
    icon: '⏱️',
    color: 'text-green-600',
  },
  financial: {
    nameRo: 'Financiar',
    icon: '💰',
    color: 'text-yellow-600',
  },
  team: {
    nameRo: 'Echipă',
    icon: '👥',
    color: 'text-purple-600',
  },
  clients: {
    nameRo: 'Clienți',
    icon: '🏢',
    color: 'text-indigo-600',
  },
  documents: {
    nameRo: 'Documente',
    icon: '📄',
    color: 'text-gray-600',
  },
};

interface ReportCategoriesSidebarProps {
  className?: string;
}

export function ReportCategoriesSidebar({ className = '' }: ReportCategoriesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<ReportCategory[]>(['cases']); // Default expand cases category
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const { selectedReportId, selectReport } = useReportsStore();

  // Fetch all available reports from API (already filtered by role on backend)
  const { reports: allReports, loading } = usePredefinedReports();

  // Group reports by category
  const reportsByCategory = useMemo(() => {
    return allReports.reduce<Record<ReportCategory, PredefinedReport[]>>(
      (acc, report) => {
        if (!acc[report.categoryId]) {
          acc[report.categoryId] = [];
        }
        acc[report.categoryId].push(report);
        return acc;
      },
      {} as Record<ReportCategory, PredefinedReport[]>
    );
  }, [allReports]);

  // Filter reports by search query
  const filteredReportsByCategory = useMemo(() => {
    return Object.entries(reportsByCategory).reduce<Record<ReportCategory, PredefinedReport[]>>(
      (acc, [categoryId, reports]) => {
        const filteredReports = (reports as PredefinedReport[]).filter(
          (report) =>
            report.nameRo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filteredReports.length > 0) {
          acc[categoryId as ReportCategory] = filteredReports;
        }
        return acc;
      },
      {} as Record<ReportCategory, PredefinedReport[]>
    );
  }, [reportsByCategory, searchQuery]);

  const toggleCategory = (categoryId: ReportCategory) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleReportSelect = (categoryId: ReportCategory, reportId: string) => {
    selectReport(categoryId, reportId);
  };

  // Loading state
  if (loading) {
    return (
      <div className={`flex h-full flex-col ${className}`}>
        <div className="border-b border-gray-200 p-4">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Search Bar */}
      <div className="border-b border-gray-200 p-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Caută rapoarte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(CATEGORY_INFO).map(([categoryId, categoryInfo]) => {
          const category = categoryId as ReportCategory;
          const reports = filteredReportsByCategory[category] || [];
          const isExpanded = expandedCategories.includes(category);
          const totalReportsInCategory = reportsByCategory[category]?.length || 0;

          // Hide empty categories when searching
          if (searchQuery && reports.length === 0) {
            return null;
          }

          // Hide categories with no reports for this user's role
          if (!searchQuery && totalReportsInCategory === 0) {
            return null;
          }

          return (
            <div key={categoryId} className="border-b border-gray-200">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{categoryInfo.icon}</span>
                  <div>
                    <h3 className={`text-sm font-semibold ${categoryInfo.color}`}>
                      {categoryInfo.nameRo}
                    </h3>
                    <span className="text-xs text-gray-500">{totalReportsInCategory} rapoarte</span>
                  </div>
                </div>
                <svg
                  className={`h-5 w-5 transform text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Reports List */}
              {isExpanded && (
                <div className="bg-gray-50">
                  {reports.length > 0 ? (
                    reports.map((report) => {
                      const isSelected = selectedReportId === report.id;

                      return (
                        <button
                          key={report.id}
                          onClick={() => handleReportSelect(category, report.id)}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                            isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium">{report.nameRo}</div>
                            <div className="text-xs text-gray-600">{report.description}</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500">Niciun raport disponibil</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Reports Section */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={() => setIsBuilderOpen(true)}
          className="w-full rounded-md border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
          + Raport Personalizat
        </button>
      </div>

      {/* Report Builder Modal */}
      <ReportBuilder isOpen={isBuilderOpen} onClose={() => setIsBuilderOpen(false)} />
    </div>
  );
}
