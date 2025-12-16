/**
 * Case Assignment Selector Component
 * Story 5.1: Email Integration and Synchronization
 *
 * Modal for assigning emails to cases with AI suggestions (AC: 2, AC: 6)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Spinner } from '@/components/ui/spinner';

const GET_USER_CASES = gql`
  query GetUserCasesForAssignment($status: CaseStatus) {
    myCases(filters: { status: $status }) {
      id
      title
      caseNumber
      client {
        name
      }
    }
  }
`;

interface Case {
  id: string;
  title: string;
  caseNumber: string;
  client?: {
    name: string;
  };
}

interface CaseAssignmentSelectorProps {
  onSelect: (caseId: string) => void;
  onClose: () => void;
  currentCaseId?: string;
  suggestedCaseId?: string;
  suggestedConfidence?: number;
}

export function CaseAssignmentSelector({
  onSelect,
  onClose,
  currentCaseId,
  suggestedCaseId,
  suggestedConfidence,
}: CaseAssignmentSelectorProps) {
  const [search, setSearch] = useState('');

  const { data, loading, error } = useQuery(GET_USER_CASES, {
    variables: { status: 'Active' },
  });

  const filteredCases = useMemo(() => {
    if (!data?.myCases) return [];

    const cases: Case[] = data.myCases;

    if (!search.trim()) return cases;

    const searchLower = search.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(searchLower) ||
        c.caseNumber.toLowerCase().includes(searchLower) ||
        c.client?.name.toLowerCase().includes(searchLower)
    );
  }, [data?.myCases, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign to Case</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
          >
            <CloseIcon />
          </button>
        </div>

        {/* AI Suggestion */}
        {suggestedCaseId && suggestedConfidence && (
          <div className="border-b border-gray-200 bg-blue-50 p-4 dark:border-gray-700 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <SparkleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                AI Suggestion
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-200">
                {Math.round(suggestedConfidence * 100)}% confident
              </span>
            </div>
            {data?.myCases?.find((c: Case) => c.id === suggestedCaseId) && (
              <button
                onClick={() => onSelect(suggestedCaseId)}
                className="mt-2 w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Use suggested case
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              autoFocus
            />
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Case list */}
        <div className="max-h-80 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">Error loading cases</div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {search ? 'No matching cases found' : 'No active cases'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCases.map((caseItem: Case) => (
                <li key={caseItem.id}>
                  <button
                    onClick={() => onSelect(caseItem.id)}
                    disabled={caseItem.id === currentCaseId}
                    className={`flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700 ${
                      caseItem.id === currentCaseId ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {caseItem.caseNumber}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {caseItem.title}
                      </div>
                      {caseItem.client && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Client: {caseItem.client.name}
                        </div>
                      )}
                    </div>
                    {caseItem.id === currentCaseId && (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Current
                      </span>
                    )}
                    {caseItem.id === suggestedCaseId && caseItem.id !== currentCaseId && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Suggested
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}
