/**
 * Analytics Page - Unified Analytics Dashboard
 *
 * Tabbed analytics dashboard combining:
 * - Financial Analytics (Revenue, Utilization, Profitability)
 * - Task Analytics (Completion, Overdue, Velocity, Patterns, etc.)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DollarSign, ListTodo } from 'lucide-react';

// Components
import { FinancialData } from '../../components/auth/FinancialData';
import { FinancialAnalyticsTab } from '../../components/analytics/FinancialAnalyticsTab';
import { TaskAnalyticsTab } from '../../components/analytics/TaskAnalyticsTab';

type AnalyticsMainTab = 'financial' | 'tasks';

/**
 * Access Denied component for unauthorized users
 */
function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Acces restricționat</h2>
      <p className="text-gray-500 max-w-sm mb-6">
        Analizele sunt disponibile doar pentru Parteneri și Administratori.
      </p>
      <button
        onClick={() => router.push('/')}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Mergi la Panou
      </button>
    </div>
  );
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
  const tabParam = searchParams.get('tab');

  // Initialize from URL param or default to 'financial'
  const [activeMainTab, setActiveMainTab] = useState<AnalyticsMainTab>(
    tabParam === 'tasks' ? 'tasks' : 'financial'
  );

  // Sync URL when tab changes
  const handleTabChange = (tab: AnalyticsMainTab) => {
    setActiveMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'financial') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `/analytics?${params.toString()}` : '/analytics';
    router.replace(newUrl, { scroll: false });
  };

  // Sync state with URL on param change
  useEffect(() => {
    if (tabParam === 'tasks' && activeMainTab !== 'tasks') {
      setActiveMainTab('tasks');
    } else if (!tabParam && activeMainTab !== 'financial') {
      setActiveMainTab('financial');
    }
  }, [tabParam, activeMainTab]);

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
    <FinancialData fallback={<AccessDenied />}>
      <AnalyticsDashboard />
    </FinancialData>
  );
}
