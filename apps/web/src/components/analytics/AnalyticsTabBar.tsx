/**
 * Analytics Tab Bar Component
 * Shared navigation for Analytics, Platform Intelligence, and Reports pages
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, ListTodo, BarChart3, FileBarChart } from 'lucide-react';

type AnalyticsTab = 'financial' | 'tasks' | 'intelligence' | 'reports';

interface AnalyticsTabBarProps {
  activeTab: AnalyticsTab;
}

const tabs: { id: AnalyticsTab; label: string; icon: React.ReactNode; href: string }[] = [
  {
    id: 'financial',
    label: 'Financiar',
    icon: <DollarSign className="w-5 h-5" />,
    href: '/analytics',
  },
  {
    id: 'tasks',
    label: 'Sarcini',
    icon: <ListTodo className="w-5 h-5" />,
    href: '/analytics?tab=tasks',
  },
  {
    id: 'intelligence',
    label: 'Inteligență Platformă',
    icon: <BarChart3 className="w-5 h-5" />,
    href: '/analytics/platform-intelligence',
  },
  {
    id: 'reports',
    label: 'Rapoarte',
    icon: <FileBarChart className="w-5 h-5" />,
    href: '/reports',
  },
];

export function AnalyticsTabBar({ activeTab }: AnalyticsTabBarProps) {
  const router = useRouter();

  const handleTabClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1" aria-label="Analytics sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.href)}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
