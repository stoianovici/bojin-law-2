/**
 * Settings Tab Bar Component
 * Shared navigation for unified Settings page
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Building2, Brain, UserX } from 'lucide-react';

export type SettingsTab = 'billing' | 'firm' | 'ai' | 'contacts';

interface SettingsTabBarProps {
  activeTab: SettingsTab;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'billing',
    label: 'Facturare',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    id: 'firm',
    label: 'Firmă',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: 'ai',
    label: 'AI Personalizare',
    icon: <Brain className="w-5 h-5" />,
  },
  {
    id: 'contacts',
    label: 'Contacte',
    icon: <UserX className="w-5 h-5" />,
  },
];

export function SettingsTabBar({ activeTab }: SettingsTabBarProps) {
  const router = useRouter();

  const handleTabClick = (tabId: SettingsTab) => {
    if (tabId === 'billing') {
      router.push('/settings/billing');
    } else {
      router.push(`/settings/billing?tab=${tabId}`);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
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
