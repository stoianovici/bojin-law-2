/**
 * Analytics Page - Unified Analytics Dashboard
 *
 * Tabbed analytics dashboard combining:
 * - Financial Analytics (Revenue, Utilization, Profitability)
 * - Task Analytics (Completion, Overdue, Velocity, Patterns, etc.)
 * - Platform Intelligence (consolidated from /analytics/platform-intelligence)
 * - Reports (consolidated from /reports)
 */

'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Components
import { FinancialData } from '../../components/auth/FinancialData';
import { FinancialAnalyticsTab } from '../../components/analytics/FinancialAnalyticsTab';
import { TaskAnalyticsTab } from '../../components/analytics/TaskAnalyticsTab';
import { AnalyticsTabBar } from '../../components/analytics/AnalyticsTabBar';

type AnalyticsMainTab = 'financial' | 'tasks';

/**
 * Redirect component for unauthorized users - OPS-014
 * Immediately redirects to dashboard instead of showing "Acces restricționat"
 */
function RedirectToDashboard() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}

/**
 * Analytics Dashboard with tabs
 */
function AnalyticsDashboard() {
  const searchParams = useSearchParams();

  // Derive active tab directly from URL param (single source of truth)
  const activeMainTab: AnalyticsMainTab =
    searchParams.get('tab') === 'tasks' ? 'tasks' : 'financial';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shared analytics tab navigation */}
      <AnalyticsTabBar activeTab={activeMainTab} />

      {/* Tab content */}
      {activeMainTab === 'financial' && <FinancialAnalyticsTab />}
      {activeMainTab === 'tasks' && <TaskAnalyticsTab />}
    </div>
  );
}

/**
 * Analytics Page Component
 * Wrapped with FinancialData to enforce authorization
 */
export default function AnalyticsPage() {
  // Set document title
  React.useEffect(() => {
    document.title = 'Analize';
  }, []);

  return (
    <FinancialData fallback={<RedirectToDashboard />}>
      <AnalyticsDashboard />
    </FinancialData>
  );
}
