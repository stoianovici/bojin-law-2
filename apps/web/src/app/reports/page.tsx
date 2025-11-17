'use client';

import { useState } from 'react';
import { ReportCategoriesSidebar } from '../../components/reports/ReportCategoriesSidebar';
import { ReportViewer } from '../../components/reports/ReportViewer';
import { DateRangeFilter } from '../../components/reports/DateRangeFilter';
import { DrillDownModal } from '../../components/reports/DrillDownModal';
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
          <span>{selectedReportId ? 'Raport selectat' : 'Selectează un raport'}</span>
          <svg
            className={`h-5 w-5 transition-transform ${isMobileSidebarOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
            <DateRangeFilter />
          </div>

          {/* Report Content Area */}
          <div className="flex-1 overflow-y-auto">
            <ReportViewer />
          </div>
        </main>
      </div>

      {/* Drill-Down Modal */}
      <DrillDownModal />
    </div>
  );
}
