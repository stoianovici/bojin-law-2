/**
 * Search Results Component
 * Story 2.10: Basic AI Search Implementation - Task 21
 *
 * Displays search results in a card layout with highlighting and scoring.
 */

'use client';

import Link from 'next/link';
import {
  type SearchResult,
  isCaseResult,
  isDocumentResult,
  isClientResult,
  getResultLink,
} from '@/hooks/useSearch';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  totalCount: number;
  searchTime: number;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function SearchResults({
  results,
  query,
  totalCount,
  searchTime,
  loading = false,
  onLoadMore,
  hasMore = false,
}: SearchResultsProps) {
  if (loading && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500">Se caută...</p>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="w-16 h-16 text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          Nu s-au găsit rezultate
        </h3>
        <p className="text-gray-500 max-w-sm">
          {query
            ? `Nu am găsit nimic care să corespundă cu "${query}". Încercați să ajustați căutarea sau filtrele.`
            : 'Introduceți un termen de căutare pentru a găsi dosare și documente.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          S-au găsit{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">{totalCount}</span>{' '}
          rezultate în <span className="font-medium">{searchTime}ms</span>
        </p>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result) => (
          <SearchResultCard key={getResultKey(result)} result={result} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="mt-6 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50"
          >
            {loading ? 'Se încarcă...' : 'Încarcă mai multe rezultate'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Search Result Card
// ============================================================================

interface SearchResultCardProps {
  result: SearchResult;
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const link = getResultLink(result);

  if (isCaseResult(result)) {
    return (
      <Link
        href={link}
        className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg shrink-0">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">Dosar</span>
              <MatchTypeBadge matchType={result.matchType} />
              <ScoreBadge score={result.score} />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {result.case.caseNumber}: {result.case.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{result.case.client.name}</span>
              <span>•</span>
              <StatusBadge status={result.case.status} />
              <span>•</span>
              <span>{new Date(result.case.openedDate).toLocaleDateString()}</span>
            </div>
            {result.highlight && (
              <p
                className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.highlight }}
              />
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (isDocumentResult(result)) {
    return (
      <Link
        href={link}
        className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-300 dark:hover:border-green-700 transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg shrink-0">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
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
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">Document</span>
              <MatchTypeBadge matchType={result.matchType} />
              <ScoreBadge score={result.score} />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {result.document.fileName}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{result.document.client.name}</span>
              <span>•</span>
              <FileTypeBadge fileType={result.document.fileType} />
              <span>•</span>
              <span>{new Date(result.document.uploadedAt).toLocaleDateString()}</span>
            </div>
            {result.highlight && (
              <p
                className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.highlight }}
              />
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (isClientResult(result)) {
    return (
      <Link
        href={link}
        className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg shrink-0">
            <svg
              className="w-5 h-5 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">Client</span>
              <MatchTypeBadge matchType={result.matchType} />
              <ScoreBadge score={result.score} />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {result.client.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              {result.client.address && (
                <>
                  <span>{result.client.address}</span>
                </>
              )}
            </div>
            {result.highlight && (
              <p
                className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.highlight }}
              />
            )}
          </div>
        </div>
      </Link>
    );
  }

  return null;
}

// ============================================================================
// Badge Components
// ============================================================================

function ScoreBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      : percentage >= 60
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${color}`}>{percentage}%</span>
  );
}

function MatchTypeBadge({ matchType }: { matchType: string }) {
  const labels: Record<string, string> = {
    FULL_TEXT: 'Cuvânt cheie',
    SEMANTIC: 'AI',
    HYBRID: 'Inteligent',
  };

  const colors: Record<string, string> = {
    FULL_TEXT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    SEMANTIC: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    HYBRID: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${colors[matchType] || colors.FULL_TEXT}`}
    >
      {labels[matchType] || matchType}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'text-green-600 dark:text-green-400',
    PendingApproval: 'text-yellow-600 dark:text-yellow-400',
    OnHold: 'text-orange-600 dark:text-orange-400',
    Closed: 'text-gray-600 dark:text-gray-400',
    Archived: 'text-gray-500 dark:text-gray-500',
  };

  const labels: Record<string, string> = {
    Active: 'Activ',
    PendingApproval: 'În așteptare aprobare',
    OnHold: 'În așteptare',
    Closed: 'Închis',
    Archived: 'Arhivat',
  };

  return (
    <span className={`text-sm ${colors[status] || colors.Active}`}>
      {labels[status] || status.replace(/([A-Z])/g, ' $1').trim()}
    </span>
  );
}

function FileTypeBadge({ fileType }: { fileType: string }) {
  const labels: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
  };

  return (
    <span className="text-sm text-gray-600 dark:text-gray-400">
      {labels[fileType] || fileType.split('/').pop()?.toUpperCase() || 'File'}
    </span>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getResultKey(result: SearchResult): string {
  if (isCaseResult(result)) {
    return `case-${result.case.id}`;
  }
  if (isDocumentResult(result)) {
    return `doc-${result.document.id}`;
  }
  if (isClientResult(result)) {
    return `client-${result.client.id}`;
  }
  return `unknown-${Math.random()}`;
}

export default SearchResults;
