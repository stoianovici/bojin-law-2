/**
 * Email Thread List Component
 * Story 5.1: Email Integration and Synchronization
 *
 * Displays email threads with conversation grouping (AC: 3)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useEmailThreads, useEmailSync } from '@/hooks/useEmailSync';
import { EmailThreadFilters } from './EmailThreadFilters';
import { Spinner } from '@/components/ui/Spinner';

interface EmailThread {
  id: string;
  conversationId: string;
  subject: string;
  participantCount: number;
  messageCount: number;
  hasUnread: boolean;
  hasAttachments: boolean;
  lastMessageDate: string;
  firstMessageDate: string;
  case?: {
    id: string;
    title: string;
    caseNumber: string;
  };
}

interface EmailThreadListProps {
  onSelectThread: (conversationId: string) => void;
  selectedThreadId?: string;
  caseId?: string;
}

export function EmailThreadList({
  onSelectThread,
  selectedThreadId,
  caseId,
}: EmailThreadListProps) {
  const [filters, setFilters] = useState<{
    hasUnread?: boolean;
    hasAttachments?: boolean;
    search?: string;
  }>({});

  const { threads, loading, error, fetchMore, refetch } = useEmailThreads(
    { ...filters, caseId },
    20
  );

  const { syncStatus, startSync, syncing } = useEmailSync();

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        fetchMore();
      }
    },
    [fetchMore]
  );

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        Error loading emails: {error.message}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header with sync controls */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Email Threads
          </h2>
          <button
            onClick={() => startSync()}
            disabled={syncing}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Spinner size="sm" />
                Syncing...
              </>
            ) : (
              <>
                <SyncIcon />
                Sync
              </>
            )}
          </button>
        </div>

        {/* Sync status */}
        {syncStatus && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {syncStatus.emailCount} emails
            {syncStatus.lastSyncAt && (
              <> · Last synced {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago</>
            )}
            {syncStatus.pendingCategorization > 0 && (
              <span className="ml-2 text-amber-600">
                {syncStatus.pendingCategorization} pending categorization
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <EmailThreadFilters
        filters={filters}
        onChange={setFilters}
        onRefresh={refetch}
      />

      {/* Thread list */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {loading && threads.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Spinner />
          </div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No email threads found
          </div>
        ) : (
          <ul
            role="listbox"
            aria-label="Email threads"
            className="divide-y divide-gray-200 dark:divide-gray-700"
          >
            {threads.map((thread: EmailThread) => (
              <li
                key={thread.id}
                role="option"
                aria-selected={selectedThreadId === thread.conversationId}
              >
                <button
                  onClick={() => onSelectThread(thread.conversationId)}
                  className={`w-full p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedThreadId === thread.conversationId
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Subject */}
                      <div className="flex items-center gap-2">
                        {thread.hasUnread && (
                          <span
                            className="h-2 w-2 rounded-full bg-blue-600"
                            aria-label="Unread messages"
                            role="img"
                          />
                        )}
                        <h3
                          className={`truncate text-sm ${
                            thread.hasUnread
                              ? 'font-semibold text-gray-900 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {thread.subject}
                        </h3>
                      </div>

                      {/* Meta info */}
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{thread.participantCount} participants</span>
                        <span>·</span>
                        <span>{thread.messageCount} messages</span>
                        {thread.hasAttachments && (
                          <>
                            <span>·</span>
                            <AttachmentIcon aria-label="Has attachments" />
                          </>
                        )}
                      </div>

                      {/* Case assignment */}
                      {thread.case ? (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {thread.case.caseNumber}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            Uncategorized
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div className="ml-4 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(thread.lastMessageDate), 'MMM d')}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {loading && threads.length > 0 && (
          <div className="flex justify-center p-4">
            <Spinner size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function SyncIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function AttachmentIcon({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}
