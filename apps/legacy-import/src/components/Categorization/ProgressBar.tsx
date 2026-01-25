'use client';

import { useDocumentStore } from '@/stores/documentStore';
import type { DocumentState } from '@/stores/documentStore';

export function ProgressBar() {
  const batch = useDocumentStore((s: DocumentState) => s.batch);
  const batchRange = useDocumentStore((s: DocumentState) => s.batchRange);
  const sessionProgress = useDocumentStore((s: DocumentState) => s.sessionProgress);
  const pagination = useDocumentStore((s: DocumentState) => s.pagination);
  const getBatchProgress = useDocumentStore((s: DocumentState) => s.getBatchProgress);
  const activeTab = useDocumentStore((s: DocumentState) => s.activeTab);
  const emailProgress = useDocumentStore((s: DocumentState) => s.emailProgress);
  const scannedProgress = useDocumentStore((s: DocumentState) => s.scannedProgress);

  const batchProgress = getBatchProgress();

  // Get progress for active tab
  const activeProgress = activeTab === 'scanned' ? scannedProgress : emailProgress;

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

  // Calculate progress for active document type
  const typeTotal = activeProgress?.total || 0;
  const typeDone = (activeProgress?.categorized || 0) + (activeProgress?.skipped || 0);
  const typePercent = typeTotal > 0 ? Math.round((typeDone / typeTotal) * 100) : 0;

  // Label for the active tab
  const tabLabel = activeTab === 'scanned' ? 'Documente Scanate' : 'Documente Email';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Page Progress (current batch/page) */}
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

      {/* Document Type Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-600">Progres {tabLabel}</span>
          <span className="text-sm text-gray-500">
            {typeDone} / {typeTotal} ({typePercent}%)
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${typePercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Categorizate: {activeProgress?.categorized || 0}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full" />
            Sărite: {activeProgress?.skipped || 0}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-400 rounded-full" />
            Rămas: {activeProgress?.remaining || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
