/**
 * Email Dashboard Page
 * Story 5.1: Email Integration and Synchronization
 *
 * Main email management page with thread list and viewing
 */

'use client';

import React, { useState } from 'react';
import { EmailThreadList, EmailThreadView, EmailSearch } from '@/components/email';
import { useEmailStats } from '@/hooks/useEmailSync';

type ViewMode = 'threads' | 'search';

export default function EmailsPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('threads');
  const { stats, loading: statsLoading } = useEmailStats();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Email
            </h1>
            {stats && !statsLoading && (
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{stats.totalEmails} total</span>
                {stats.unreadEmails > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    {stats.unreadEmails} unread
                  </span>
                )}
                {stats.uncategorizedEmails > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {stats.uncategorizedEmails} uncategorized
                  </span>
                )}
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setViewMode('threads')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'threads'
                  ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Threads
            </button>
            <button
              onClick={() => setViewMode('search')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'search'
                  ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'threads' ? (
          <>
            {/* Thread list */}
            <div className="w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
              <EmailThreadList
                onSelectThread={setSelectedThreadId}
                selectedThreadId={selectedThreadId || undefined}
              />
            </div>

            {/* Thread view */}
            <div className="flex-1">
              {selectedThreadId ? (
                <EmailThreadView
                  conversationId={selectedThreadId}
                  onClose={() => setSelectedThreadId(null)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <EmailIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2">Select a thread to view</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1">
            <EmailSearch
              onSelectEmail={(emailId) => {
                // TODO: Navigate to email view or open modal
                console.log('Selected email:', emailId);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}
