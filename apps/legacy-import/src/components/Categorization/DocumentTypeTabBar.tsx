'use client';

import { useDocumentStore } from '@/stores/documentStore';
import type { DocumentState, DocumentTypeTab, TypeProgress } from '@/stores/documentStore';
import { Mail, FileText } from 'lucide-react';

interface TabInfo {
  id: DocumentTypeTab;
  label: string;
  icon: typeof Mail;
  progress: TypeProgress | null;
}

export function DocumentTypeTabBar() {
  const activeTab = useDocumentStore((s: DocumentState) => s.activeTab);
  const setActiveTab = useDocumentStore((s: DocumentState) => s.setActiveTab);
  const emailProgress = useDocumentStore((s: DocumentState) => s.emailProgress);
  const scannedProgress = useDocumentStore((s: DocumentState) => s.scannedProgress);

  const tabs: TabInfo[] = [
    {
      id: 'email',
      label: 'Documente Email',
      icon: Mail,
      progress: emailProgress,
    },
    {
      id: 'scanned',
      label: 'Documente Scanate',
      icon: FileText,
      progress: scannedProgress,
    },
  ];

  const formatProgress = (progress: TypeProgress | null) => {
    if (!progress) return '';
    const done = progress.categorized + progress.skipped;
    return `${done}/${progress.total}`;
  };

  return (
    <div className="flex-shrink-0 flex bg-gray-100 rounded-md p-0.5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const progressText = formatProgress(tab.progress);
        const hasDocuments = tab.progress && tab.progress.total > 0;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={!hasDocuments}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap
              ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : hasDocuments
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.id === 'email' ? 'Email' : 'Scanate'}</span>
            {progressText && (
              <span className={`text-[10px] ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                {progressText}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
