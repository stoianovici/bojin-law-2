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
    <div className="bg-white rounded-lg border border-gray-200 p-1">
      <div className="flex">
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
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : hasDocuments
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {progressText && (
                <span
                  className={`
                    ml-1 px-2 py-0.5 rounded-full text-xs
                    ${
                      isActive
                        ? 'bg-blue-500 text-blue-100'
                        : hasDocuments
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-400'
                    }
                  `}
                >
                  {progressText}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
