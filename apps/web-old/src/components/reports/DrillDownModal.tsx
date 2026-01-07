'use client';

import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useReportsStore } from '../../stores/reports.store';

const ROWS_PER_PAGE = 10;

export function DrillDownModal() {
  const { drillDownModal, closeDrillDown } = useReportsStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingDrillDown, setExportingDrillDown] = useState(false);

  const { data } = drillDownModal;

  const totalPages = useMemo(() => {
    if (!data?.detailRows) return 0;
    return Math.ceil(data.detailRows.length / ROWS_PER_PAGE);
  }, [data?.detailRows]);

  const paginatedRows = useMemo(() => {
    if (!data?.detailRows) return [];
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return data.detailRows.slice(startIndex, endIndex);
  }, [data, currentPage]);

  const handleExportDrillDown = async () => {
    setExportingDrillDown(true);
    // Simulate export process
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setExportingDrillDown(false);
  };

  const handleClose = () => {
    setCurrentPage(1);
    closeDrillDown();
  };

  const formatValue = (value: unknown, type: 'text' | 'number' | 'date' | 'currency') => {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('ro-RO') : String(value);
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('ro-RO');
        }
        if (typeof value === 'string' || typeof value === 'number') {
          return new Date(value).toLocaleDateString('ro-RO');
        }
        return String(value);
      case 'currency':
        return typeof value === 'number'
          ? `${value.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`
          : String(value);
      default:
        return String(value);
    }
  };

  return (
    <Dialog.Root open={drillDownModal.isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Detalii: {data?.dataPoint?.label || 'N/A'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">
                {data?.detailRows?.length || 0} înregistrări găsite
              </Dialog.Description>
            </div>

            {/* Table */}
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {data && data.columns && paginatedRows.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {data.columns.map((column) => (
                        <th
                          key={column.key}
                          className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700"
                        >
                          {column.labelRo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginatedRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                        {data.columns.map((column) => (
                          <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                            {formatValue(row[column.key], column.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-32 items-center justify-center text-gray-500">
                  <p className="text-sm">Nu există date disponibile</p>
                </div>
              )}
            </div>

            {/* Footer - Pagination & Actions */}
            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-600">
                      Pagina {currentPage} din {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Următor
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportDrillDown}
                    disabled={exportingDrillDown}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingDrillDown ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-transparent"></div>
                        Exportare...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Exportă
                      </>
                    )}
                  </button>
                  <Dialog.Close asChild>
                    <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      Închide
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
