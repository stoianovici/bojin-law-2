/**
 * Rate History Modal Component
 * Story 2.8.1: Billing & Rate Management - Task 14
 *
 * Displays timeline of rate changes for a case.
 * Partners only - financial data.
 */

'use client';

import { useState, useMemo } from 'react';
import { useRateHistory, type RateHistoryEntry } from '@/hooks/useRateHistory';

interface RateHistoryModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Converts cents to dollars for display
 */
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format rate type label
 */
function formatRateType(rateType: string): string {
  const labels: Record<string, string> = {
    partner: 'Partner Rate',
    associate: 'Associate Rate',
    paralegal: 'Paralegal Rate',
    fixed: 'Fixed Amount',
  };
  return labels[rateType] || rateType;
}

/**
 * Timeline Entry Component
 */
function TimelineEntry({ entry, isLast }: { entry: RateHistoryEntry; isLast: boolean }) {
  const rateChanged = entry.newRate !== entry.oldRate;
  const isIncrease = entry.newRate > entry.oldRate;

  return (
    <div className="relative pb-8">
      {/* Timeline connector line */}
      {!isLast && (
        <span
          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-linear-border-subtle"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-start space-x-3">
        {/* Timeline dot */}
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-accent/15 ring-8 ring-linear-bg-secondary">
            <div className="h-3 w-3 rounded-full bg-linear-accent" />
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 bg-linear-bg-tertiary rounded-lg p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-linear-text-primary">
                {formatRateType(entry.rateType)} Updated
              </p>
              <p className="text-xs text-linear-text-tertiary">
                {formatDate(entry.changedAt)} at {formatTime(entry.changedAt)}
              </p>
            </div>
            {rateChanged && (
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  isIncrease ? 'bg-linear-success/15 text-linear-success' : 'bg-linear-error/15 text-linear-error'
                }`}
              >
                {isIncrease ? '↑' : '↓'} {isIncrease ? 'Increased' : 'Decreased'}
              </span>
            )}
          </div>

          {/* Rate change details */}
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-sm text-linear-text-secondary">${centsToDollars(entry.oldRate)}</span>
            <span className="text-linear-text-muted">→</span>
            <span className="text-sm font-semibold text-linear-text-primary">
              ${centsToDollars(entry.newRate)}
            </span>
            <span className="text-xs text-linear-text-tertiary">
              ({isIncrease ? '+' : ''}${centsToDollars(Math.abs(entry.newRate - entry.oldRate))})
            </span>
          </div>

          {/* Changed by */}
          <p className="text-xs text-linear-text-tertiary">
            Changed by:{' '}
            <span className="font-medium text-linear-text-secondary">
              {entry.changedBy.firstName} {entry.changedBy.lastName}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState() {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-linear-text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-linear-text-primary">No rate changes</h3>
      <p className="mt-1 text-sm text-linear-text-tertiary">This case has no rate change history yet.</p>
    </div>
  );
}

/**
 * Rate History Modal Component
 */
export function RateHistoryModal({ caseId, isOpen, onClose }: RateHistoryModalProps) {
  const { history, loading, error } = useRateHistory(caseId);
  const [filterRateType, setFilterRateType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and search logic
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Filter by rate type
    if (filterRateType !== 'all') {
      filtered = filtered.filter((entry) => entry.rateType === filterRateType);
    }

    // Search by user name
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.changedBy.firstName.toLowerCase().includes(term) ||
          entry.changedBy.lastName.toLowerCase().includes(term) ||
          entry.changedBy.email.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [history, filterRateType, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="bg-linear-bg-secondary rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-linear-border-subtle flex items-center justify-between">
          <h2 className="text-xl font-semibold text-linear-text-primary">Rate Change History</h2>
          <button
            onClick={onClose}
            className="text-linear-text-muted hover:text-linear-text-secondary transition-colors"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-linear-border-subtle space-y-3">
          {/* Search */}
          <div>
            <label htmlFor="search" className="sr-only">
              Search by user
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by user name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent bg-linear-bg-secondary text-linear-text-primary"
            />
          </div>

          {/* Rate Type Filter */}
          <div className="flex items-center space-x-2">
            <label htmlFor="rateTypeFilter" className="text-sm font-medium text-linear-text-secondary">
              Filter by type:
            </label>
            <select
              id="rateTypeFilter"
              value={filterRateType}
              onChange={(e) => setFilterRateType(e.target.value)}
              className="px-3 py-1.5 border border-linear-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-linear-accent bg-linear-bg-secondary text-linear-text-primary"
            >
              <option value="all">All Changes</option>
              <option value="partner">Partner Rate</option>
              <option value="associate">Associate Rate</option>
              <option value="paralegal">Paralegal Rate</option>
              <option value="fixed">Fixed Amount</option>
            </select>

            {/* Result count */}
            <span className="text-sm text-linear-text-tertiary ml-auto">
              {filteredHistory.length} {filteredHistory.length === 1 ? 'change' : 'changes'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-linear-accent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-linear-error">Failed to load rate history</p>
              <p className="text-sm text-linear-text-tertiary mt-1">{error.message}</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            history.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="text-center py-12">
                <p className="text-linear-text-secondary">No changes match your filters</p>
                <button
                  onClick={() => {
                    setFilterRateType('all');
                    setSearchTerm('');
                  }}
                  className="mt-2 text-sm text-linear-accent hover:text-linear-accent-hover"
                >
                  Clear filters
                </button>
              </div>
            )
          ) : (
            <div className="flow-root">
              <ul className="space-y-0">
                {filteredHistory.map((entry, index) => (
                  <li key={entry.id}>
                    <TimelineEntry entry={entry} isLast={index === filteredHistory.length - 1} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-linear-border-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary rounded-md hover:bg-linear-bg-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
