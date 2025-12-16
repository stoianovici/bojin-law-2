/**
 * Email Dashboard Widget
 * Story 5.1: Email Integration and Synchronization
 *
 * Shows email summary and quick actions on dashboard (AC: 6)
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useEmailStats, useEmailSync } from '@/hooks/useEmailSync';
import { Spinner } from '@/components/ui/spinner';

export function EmailWidget() {
  const { stats, loading: statsLoading, error: statsError } = useEmailStats();
  const { syncStatus, startSync, syncing } = useEmailSync();

  if (statsLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center p-4">
          <Spinner />
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-red-600">Failed to load email stats</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EmailIcon className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email</h3>
        </div>
        <Link
          href="/emails"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          View all
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <StatCard label="Total" value={stats.totalEmails} icon={<InboxIcon />} />
          <StatCard
            label="Unread"
            value={stats.unreadEmails}
            icon={<UnreadIcon />}
            highlight={stats.unreadEmails > 0}
          />
          <StatCard
            label="Uncategorized"
            value={stats.uncategorizedEmails}
            icon={<FolderIcon />}
            highlight={stats.uncategorizedEmails > 0}
            highlightColor="amber"
          />
          <StatCard
            label="With Attachments"
            value={stats.emailsWithAttachments}
            icon={<AttachmentIcon />}
          />
        </div>
      )}

      {/* Sync status */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {syncStatus?.lastSyncAt ? (
            <>Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}</>
          ) : (
            'Not synced yet'
          )}
        </div>
        <button
          onClick={() => startSync()}
          disabled={syncing}
          className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          {syncing ? (
            <>
              <Spinner size="xs" />
              Syncing...
            </>
          ) : (
            <>
              <SyncIcon />
              Sync Now
            </>
          )}
        </button>
      </div>

      {/* Quick action for uncategorized */}
      {stats && stats.uncategorizedEmails > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You have {stats.uncategorizedEmails} email
            {stats.uncategorizedEmails !== 1 ? 's' : ''} that need{' '}
            {stats.uncategorizedEmails === 1 ? 's' : ''} to be assigned to cases.
          </p>
          <Link
            href="/emails?filter=uncategorized"
            className="mt-2 inline-block text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300"
          >
            Review now →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
  highlightColor = 'blue',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
  highlightColor?: 'blue' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div
      className={`rounded-lg p-3 ${
        highlight ? colors[highlightColor] : 'bg-gray-50 dark:bg-gray-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={highlight ? '' : 'text-gray-400'}>{icon}</div>
        <div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Icons
function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

function UnreadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function AttachmentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
