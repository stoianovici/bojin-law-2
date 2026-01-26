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

  // Active progress for current tab

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {/* Page Progress */}
      <span className="text-gray-400 whitespace-nowrap truncate max-w-[120px]" title={batchLabel}>
        {batchLabel}
        {pageLabel}
      </span>
      <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${batchPercent}%` }} />
      </div>
      <span className="text-gray-400 whitespace-nowrap">
        {batchProgress.done}/{batchProgress.total}
      </span>

      {/* Type Progress - inline stats */}
      <div className="flex items-center gap-1.5 text-gray-500 border-l border-gray-200 pl-2 ml-1">
        <span className="flex items-center gap-0.5" title="Categorizate">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          {activeProgress?.categorized || 0}
        </span>
        <span className="flex items-center gap-0.5" title="Sărite">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          {activeProgress?.skipped || 0}
        </span>
        <span className="flex items-center gap-0.5" title="Rămase">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          {activeProgress?.remaining || 0}
        </span>
      </div>
    </div>
  );
}
