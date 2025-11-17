/**
 * CommunicationsTab - Shows all communication threads for a case
 * Displays processed and active threads with filtering and linked tasks
 */

'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../../stores/communication.store';
import { CheckCircle, Mail, Calendar } from 'lucide-react';
import type { CommunicationThread } from '@legal-platform/types';

export interface CommunicationsTabProps {
  caseId?: string;
  className?: string;
}

/**
 * CommunicationsTab Component
 *
 * Shows all threads for a case including processed ones
 * Allows filtering by processed status and displays linked tasks
 */
export function CommunicationsTab({ caseId, className }: CommunicationsTabProps) {
  const { threads } = useCommunicationStore();
  const [filterProcessedOnly, setFilterProcessedOnly] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Filter threads for current case
  const caseThreads = useMemo(() => {
    let filtered = threads;

    // Filter by caseId if provided
    if (caseId) {
      filtered = filtered.filter(t => t.caseId === caseId);
    }

    // Apply processed filter
    if (filterProcessedOnly) {
      filtered = filtered.filter(t => t.isProcessed);
    }

    return filtered;
  }, [threads, caseId, filterProcessedOnly]);

  const selectedThread = caseThreads.find(t => t.id === selectedThreadId);

  // Helper to count tasks created from thread
  const getThreadTaskCount = (thread: CommunicationThread): number => {
    const allItems = [
      ...thread.extractedItems.deadlines,
      ...thread.extractedItems.commitments,
      ...thread.extractedItems.actionItems,
    ];
    return allItems.filter(item => item.convertedToTaskId).length;
  };

  // Helper to get task titles from thread (mock for now)
  const getThreadTasks = (thread: CommunicationThread) => {
    const tasks: Array<{ id: string; title: string; type: string }> = [];

    thread.extractedItems.deadlines
      .filter(d => d.convertedToTaskId)
      .forEach(d => {
        tasks.push({
          id: d.convertedToTaskId!,
          title: d.description,
          type: 'deadline',
        });
      });

    thread.extractedItems.commitments
      .filter(c => c.convertedToTaskId)
      .forEach(c => {
        tasks.push({
          id: c.convertedToTaskId!,
          title: c.commitmentText,
          type: 'commitment',
        });
      });

    thread.extractedItems.actionItems
      .filter(a => a.convertedToTaskId)
      .forEach(a => {
        tasks.push({
          id: a.convertedToTaskId!,
          title: a.description,
          type: 'actionItem',
        });
      });

    return tasks;
  };

  // Format date helper
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Header with Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Comunicații pentru Dosar
          </h3>

          {/* Filter Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterProcessedOnly}
              onChange={(e) => setFilterProcessedOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Afișează doar procesate
            </span>
          </label>
        </div>

        <p className="text-sm text-gray-600 mt-1">
          {caseThreads.length} {caseThreads.length === 1 ? 'fir' : 'fire'} de discuții
        </p>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto p-4">
        {caseThreads.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">
              {filterProcessedOnly
                ? 'Nu există comunicări procesate pentru acest dosar'
                : 'Nu există comunicări pentru acest dosar'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {caseThreads.map((thread) => {
              const taskCount = getThreadTaskCount(thread);
              const threadTasks = getThreadTasks(thread);

              return (
                <div
                  key={thread.id}
                  className={clsx(
                    'border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow',
                    selectedThreadId === thread.id && 'ring-2 ring-blue-500'
                  )}
                >
                  {/* Thread Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-semibold text-gray-900">
                          {thread.subject}
                        </h4>
                        {thread.isProcessed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Procesat
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {thread.messages.length} {thread.messages.length === 1 ? 'mesaj' : 'mesaje'} •
                        {' '}{formatDate(thread.lastMessageDate)}
                      </p>
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                    <Mail className="w-4 h-4" />
                    <span>
                      {thread.participants.map(p => p.name).join(', ')}
                    </span>
                  </div>

                  {/* Processed Info */}
                  {thread.isProcessed && thread.processedAt && (
                    <div className="text-xs text-gray-500 mb-3">
                      Procesat la: {formatDate(thread.processedAt)}
                    </div>
                  )}

                  {/* Linked Tasks */}
                  {threadTasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Task-uri create ({taskCount}):
                      </p>
                      <div className="space-y-1.5">
                        {threadTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 cursor-pointer"
                            onClick={() => {
                              // Navigate to task (mock implementation)
                              console.log('Navigate to task:', task.id);
                              alert(`Navigare către task: ${task.title}`);
                            }}
                          >
                            <Calendar className="w-4 h-4" />
                            <span className="underline">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Thread Button */}
                  <button
                    onClick={() => setSelectedThreadId(thread.id)}
                    className="mt-3 w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Vizualizează Fir Complet
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Thread Detail Modal (optional enhancement) */}
      {selectedThread && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedThread.subject}
                </h3>
                <button
                  onClick={() => setSelectedThreadId(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedThread.messages.map((message) => (
                  <div key={message.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{message.senderName}</span>
                      <span className="text-sm text-gray-500">{formatDate(message.sentDate)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
