'use client';

import { useState } from 'react';
import { ReportCategoriesSidebar } from '../../components/reports/ReportCategoriesSidebar';
import { ReportViewer } from '../../components/reports/ReportViewer';
import { useReportsStore } from '../../stores/reports.store';

export default function ReportsPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { selectedReportId } = useReportsStore();

  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      {/* Mobile Header - Shows dropdown button on tablet/mobile */}
      <div className="block border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>
            {selectedReportId
              ? 'Raport selectat'
              : 'Selectează un raport'}
          </span>
          <svg
            className={`h-5 w-5 transition-transform ${
              isMobileSidebarOpen ? 'rotate-180' : ''
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Report Categories */}
        <aside
          className={`
            w-full border-r border-gray-200 bg-white
            lg:w-64 lg:block
            ${isMobileSidebarOpen ? 'block' : 'hidden lg:block'}
          `}
        >
          <ReportCategoriesSidebar />
        </aside>

        {/* Right Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar - Date Range Filter & Export Buttons */}
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              {/* Placeholder for DateRangeFilter - Task 3 */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm">
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-gray-700">Luna Aceasta</span>
                </div>
              </div>

              {/* Export Buttons - Placeholder for Task 10 */}
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
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
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Exportă
                </button>
              </div>
            </div>
          </div>

          {/* Report Content Area */}
          <div className="flex-1 overflow-y-auto">
            <ReportViewer />
          </div>
        </main>
      </div>
    </div>
  );
}
