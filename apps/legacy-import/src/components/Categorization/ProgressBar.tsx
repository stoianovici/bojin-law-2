'use client';

import { useDocumentStore } from '@/stores/documentStore';
import type { DocumentState } from '@/stores/documentStore';

export function ProgressBar() {
  const batch = useDocumentStore((s: DocumentState) => s.batch);
  const batchRange = useDocumentStore((s: DocumentState) => s.batchRange);
  const sessionProgress = useDocumentStore((s: DocumentState) => s.sessionProgress);
  const pagination = useDocumentStore((s: DocumentState) => s.pagination);
  const getBatchProgress = useDocumentStore((s: DocumentState) => s.getBatchProgress);

  const batchProgress = getBatchProgress();

  if (!batch || !sessionProgress) {
    return null;
  }

  // Show range if multiple batches, otherwise single month
  const batchLabel = batchRange || batch.monthYear;
  const pageLabel =
    pagination && pagination.totalPages > 1
      ? ` (Pagina ${pagination.page + 1}/${pagination.totalPages})`
      : '';

  const batchPercent =
    batchProgress.total > 0 ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0;

  const sessionPercent =
    sessionProgress.totalDocuments > 0
      ? Math.round(
          ((sessionProgress.categorizedCount + sessionProgress.skippedCount) /
            sessionProgress.totalDocuments) *
            100
        )
      : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Batch Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">
            Pagina curentă: {batchLabel}
            {pageLabel}
          </span>
          <span className="text-sm text-gray-500">
            {batchProgress.done} / {batchProgress.total} ({batchPercent}%)
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${batchPercent}%` }}
          />
        </div>
      </div>

      {/* Session Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-600">Total sesiune</span>
          <span className="text-sm text-gray-500">
            {sessionProgress.categorizedCount + sessionProgress.skippedCount} /{' '}
            {sessionProgress.totalDocuments} ({sessionPercent}%)
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${sessionPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Categorizate: {sessionProgress.categorizedCount}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full" />
            Sărite: {sessionProgress.skippedCount}
          </span>
          {sessionProgress.analyzedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
              Analizate AI: {sessionProgress.analyzedCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
