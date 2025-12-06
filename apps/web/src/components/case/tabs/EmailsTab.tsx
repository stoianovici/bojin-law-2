/**
 * Emails Tab for Case Detail Page
 * Story 5.1: Email Integration and Synchronization
 *
 * Shows emails associated with a specific case (AC: 6)
 */

'use client';

import React, { useState } from 'react';
import { EmailThreadList, EmailThreadView } from '@/components/email';
import { useEmails } from '@/hooks/useEmailSync';
import { Spinner } from '@/components/ui/Spinner';
import { format } from 'date-fns';

interface EmailsTabProps {
  caseId: string;
}

export function EmailsTab({ caseId }: EmailsTabProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { emails, totalCount, loading } = useEmails({ caseId }, 50);

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-[600px] rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Email list for this case */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto dark:border-gray-700">
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Case Emails
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalCount} email{totalCount !== 1 ? 's' : ''} in this case
          </p>
        </div>

        {emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <EmailIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm">No emails assigned to this case</p>
            <p className="mt-1 text-xs">
              Assign emails from the Email page
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {emails.map((email: any) => (
              <li key={email.id}>
                <button
                  onClick={() => setSelectedThreadId(email.conversationId)}
                  className={`w-full p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedThreadId === email.conversationId
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!email.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {email.from.name || email.from.address}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-600 dark:text-gray-300">
                    {email.subject}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {format(new Date(email.receivedDateTime), 'MMM d, h:mm a')}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Thread view */}
      <div className="flex-1 overflow-hidden">
        {selectedThreadId ? (
          <EmailThreadView
            conversationId={selectedThreadId}
            onClose={() => setSelectedThreadId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <EmailIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-sm">Select an email to view</p>
            </div>
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
