/**
 * Analytics Page - Partner-only KPI Dashboard
 * Displays firm-wide KPIs, billable hours, case distribution, and pending approvals
 */

'use client';

import React from 'react';
import { useNavigationStore } from '@/stores/navigation.store';
import { useDashboardStore } from '@/stores/dashboard.store';
import { useRouter } from 'next/navigation';

// Import KPI widgets that were moved from Partner dashboard
import { FirmKPIsWidget } from '@/components/dashboard/widgets/FirmKPIsWidget';
import { BillableHoursChartWidget } from '@/components/dashboard/widgets/BillableHoursChartWidget';
import { CaseDistributionWidget } from '@/components/dashboard/widgets/CaseDistributionWidget';
import { PendingApprovalsWidget } from '@/components/dashboard/widgets/PendingApprovalsWidget';

import type { KPIWidget, ChartWidget, ApprovalListWidget } from '@legal-platform/types';

/**
 * Analytics Page Component
 * Role-based access: Partner only
 */
export default function AnalyticsPage() {
  const currentRole = useNavigationStore((state) => state.currentRole);
  const router = useRouter();

  // Redirect non-Partners to dashboard
  React.useEffect(() => {
    if (currentRole !== 'Partner') {
      console.warn('[Analytics] Non-Partner user attempted to access Analytics. Redirecting to dashboard.');
      router.push('/');
    }
  }, [currentRole, router]);

  // Return null while redirecting
  if (currentRole !== 'Partner') {
    return null;
  }

  // Mock KPI widget data (will be replaced with real data from backend)
  const firmKPIsWidget: KPIWidget = {
    id: 'firm-kpis',
    type: 'kpi',
    title: 'KPI-uri Firmă',
    position: { i: 'firm-kpis', x: 0, y: 0, w: 12, h: 3 },
    metrics: [
      {
        label: 'Venituri Luna Curentă',
        value: '€125,000',
        trend: { direction: 'up', percentage: 12, comparison: 'vs luna trecută' },
      },
      {
        label: 'Ore Facturabile',
        value: '1,240',
        trend: { direction: 'up', percentage: 8, comparison: 'vs săptămâna trecută' },
      },
      {
        label: 'Cazuri Active',
        value: '48',
        trend: { direction: 'neutral', percentage: 0, comparison: 'vs luna trecută' },
      },
      {
        label: 'Rata Finalizare',
        value: '92%',
        trend: { direction: 'up', percentage: 5, comparison: 'vs media anuală' },
      },
    ],
  };

  const billableHoursWidget: ChartWidget = {
    id: 'billable-hours-chart',
    type: 'chart',
    chartType: 'bar',
    title: 'Ore Facturabile - Ultimele 4 Săptămâni',
    position: { i: 'billable-hours-chart', x: 0, y: 3, w: 8, h: 5 },
    data: [
      { week: 'S1', hours: 280 },
      { week: 'S2', hours: 310 },
      { week: 'S3', hours: 295 },
      { week: 'S4', hours: 345 },
    ],
    xAxisKey: 'week',
    yAxisKey: 'hours',
    legend: true,
  };

  const caseDistributionWidget: ChartWidget = {
    id: 'case-distribution',
    type: 'chart',
    chartType: 'pie',
    title: 'Distribuție Cazuri pe Tip',
    position: { i: 'case-distribution', x: 8, y: 3, w: 4, h: 5 },
    data: [
      { type: 'Civil', count: 18 },
      { type: 'Comercial', count: 15 },
      { type: 'Penal', count: 8 },
      { type: 'Administrativ', count: 7 },
    ],
    dataKey: 'count',
    legend: true,
  };

  const pendingApprovalsWidget: ApprovalListWidget = {
    id: 'pending-approvals',
    type: 'approvalList',
    title: 'Aprobări în Așteptare',
    position: { i: 'pending-approvals', x: 0, y: 8, w: 12, h: 4 },
    approvals: [
      {
        id: '1',
        itemName: 'Contract Parteneriat - ClientCorp SRL',
        requester: 'Ion Popescu',
        submittedDate: new Date('2025-11-12'),
        type: 'document',
      },
      {
        id: '2',
        itemName: 'Înregistrare Timp - 15 ore',
        requester: 'Maria Ionescu',
        submittedDate: new Date('2025-11-11'),
        type: 'timeEntry',
      },
      {
        id: '3',
        itemName: 'Cheltuieli Deplasare București',
        requester: 'Andrei Gheorghe',
        submittedDate: new Date('2025-11-10'),
        type: 'expense',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics & KPIs</h1>
              <p className="mt-1 text-sm text-gray-600">
                Vizualizare KPI-uri și metrici firmă pentru parteneri
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Selector (mockup) */}
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue="30d"
              >
                <option value="7d">Ultimele 7 zile</option>
                <option value="30d">Ultimele 30 zile</option>
                <option value="90d">Ultimele 90 zile</option>
                <option value="1y">Ultimul an</option>
              </select>
              <button
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                onClick={() => {
                  // Export analytics data
                  alert('Export Analytics - To be implemented');
                }}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Widgets */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Firm KPIs Widget */}
          <div>
            <FirmKPIsWidget widget={firmKPIsWidget} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <BillableHoursChartWidget widget={billableHoursWidget} />
            </div>
            <div className="lg:col-span-4">
              <CaseDistributionWidget widget={caseDistributionWidget} />
            </div>
          </div>

          {/* Pending Approvals Widget */}
          <div>
            <PendingApprovalsWidget widget={pendingApprovalsWidget} />
          </div>
        </div>
      </div>
    </div>
  );
}
