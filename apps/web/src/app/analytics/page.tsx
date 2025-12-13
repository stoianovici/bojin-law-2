/**
 * Analytics Page - Unified Analytics Dashboard
 *
 * Tabbed analytics dashboard combining:
 * - Financial Analytics (Revenue, Utilization, Profitability)
 * - Task Analytics (Completion, Overdue, Velocity, Patterns, etc.)
 */

'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DollarSign, ListTodo } from 'lucide-react';

// Components
import { FinancialData } from '../../components/auth/FinancialData';
import { FinancialAnalyticsTab } from '../../components/analytics/FinancialAnalyticsTab';
import { TaskAnalyticsTab } from '../../components/analytics/TaskAnalyticsTab';

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

// Main tab configuration
const mainTabs: { id: AnalyticsMainTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'financial',
    label: 'Analize Financiare',
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: 'tasks',
    label: 'Analize Sarcini',
    icon: <ListTodo className="w-5 h-5" />,
  },
];

/**
 * Analytics Dashboard with tabs
 */
function AnalyticsDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Derive active tab directly from URL param (single source of truth)
  const activeMainTab: AnalyticsMainTab =
    searchParams.get('tab') === 'tasks' ? 'tasks' : 'financial';

  // Update URL when tab changes
  const handleTabChange = (tab: AnalyticsMainTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'financial') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `/analytics?${params.toString()}` : '/analytics';
    router.replace(newUrl, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main tab navigation */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1" aria-label="Analytics sections">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  ${
                    activeMainTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                aria-current={activeMainTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

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
