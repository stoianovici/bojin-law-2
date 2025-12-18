/**
 * Recipient Selector Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Select recipient type and filter for bulk communications
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  useRecipientTypes,
  type BulkRecipientType,
  type RecipientFilter,
  type CustomRecipient,
} from '@/hooks/useBulkCommunication';
import { Users, Building, Briefcase, UserPlus, X, AlertCircle, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface RecipientSelectorProps {
  recipientType: BulkRecipientType;
  recipientFilter: RecipientFilter;
  onRecipientTypeChange: (type: BulkRecipientType) => void;
  onFilterChange: (filter: RecipientFilter) => void;
  onRecipientsResolved: (recipients: CustomRecipient[]) => void;
  caseId?: string;
  className?: string;
}

interface Case {
  id: string;
  title: string;
  caseNumber: string;
}

interface CaseType {
  id: string;
  name: string;
}

// ============================================================================
// Mock Data (would be replaced with actual API calls)
// ============================================================================

const MOCK_CASES: Case[] = [
  { id: '1', title: 'Smith vs. Johnson', caseNumber: 'C-2024-001' },
  { id: '2', title: 'Estate of Williams', caseNumber: 'C-2024-002' },
  { id: '3', title: 'Brown Contract Dispute', caseNumber: 'C-2024-003' },
];

const MOCK_CASE_TYPES: CaseType[] = [
  { id: '1', name: 'Civil Litigation' },
  { id: '2', name: 'Family Law' },
  { id: '3', name: 'Real Estate' },
  { id: '4', name: 'Corporate' },
  { id: '5', name: 'Criminal Defense' },
];

// Mock function to resolve recipients (would be API call)
const resolveRecipients = async (
  type: BulkRecipientType,
  filter: RecipientFilter
): Promise<CustomRecipient[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  switch (type) {
    case 'CaseClients':
      return [
        { id: 'c1', name: 'John Smith', email: 'john.smith@email.com' },
        { id: 'c2', name: 'Jane Doe', email: 'jane.doe@email.com' },
      ];
    case 'CaseTeam':
      return [
        { id: 't1', name: 'Alice Johnson', email: 'alice@firm.com' },
        { id: 't2', name: 'Bob Williams', email: 'bob@firm.com' },
        { id: 't3', name: 'Carol Davis', email: 'carol@firm.com' },
      ];
    case 'AllClients':
      return [
        { id: 'ac1', name: 'Client One', email: 'client1@email.com' },
        { id: 'ac2', name: 'Client Two', email: 'client2@email.com' },
        { id: 'ac3', name: 'Client Three', email: 'client3@email.com' },
        { id: 'ac4', name: 'Client Four', email: 'client4@email.com' },
        { id: 'ac5', name: 'Client Five', email: 'client5@email.com' },
      ];
    case 'CaseTypeClients':
      const count = (filter.caseTypes?.length || 1) * 3;
      return Array.from({ length: count }, (_, i) => ({
        id: `ctc${i}`,
        name: `Type Client ${i + 1}`,
        email: `typeclient${i + 1}@email.com`,
      }));
    case 'CustomList':
      return filter.customRecipients || [];
    default:
      return [];
  }
};

// ============================================================================
// Component
// ============================================================================

export function RecipientSelector({
  recipientType,
  recipientFilter,
  onRecipientTypeChange,
  onFilterChange,
  onRecipientsResolved,
  caseId,
  className = '',
}: RecipientSelectorProps) {
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCases, setSelectedCases] = useState<string[]>(
    recipientFilter.caseIds || (caseId ? [caseId] : [])
  );
  const [selectedCaseTypes, setSelectedCaseTypes] = useState<string[]>(
    recipientFilter.caseTypes || []
  );
  const [customRecipients, setCustomRecipients] = useState<CustomRecipient[]>(
    recipientFilter.customRecipients || []
  );
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });

  // Hooks
  const { recipientTypes } = useRecipientTypes();

  // Get icon for recipient type
  const getTypeIcon = (type: BulkRecipientType) => {
    switch (type) {
      case 'CaseClients':
        return <Users className="h-4 w-4" />;
      case 'CaseTeam':
        return <Briefcase className="h-4 w-4" />;
      case 'AllClients':
        return <Building className="h-4 w-4" />;
      case 'CaseTypeClients':
        return <Users className="h-4 w-4" />;
      case 'CustomList':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  // Resolve recipients when filter changes
  useEffect(() => {
    const resolve = async () => {
      setLoading(true);
      setError(null);

      try {
        const filter: RecipientFilter = {};

        switch (recipientType) {
          case 'CaseClients':
          case 'CaseTeam':
            filter.caseIds = selectedCases;
            break;
          case 'CaseTypeClients':
            filter.caseTypes = selectedCaseTypes;
            break;
          case 'CustomList':
            filter.customRecipients = customRecipients;
            break;
        }

        onFilterChange(filter);

        const recipients = await resolveRecipients(recipientType, filter);
        onRecipientsResolved(recipients);
      } catch (err) {
        setError('Failed to resolve recipients');
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [
    recipientType,
    selectedCases,
    selectedCaseTypes,
    customRecipients,
    onFilterChange,
    onRecipientsResolved,
  ]);

  // Add custom recipient
  const handleAddCustomRecipient = useCallback(() => {
    if (!newRecipient.name.trim() || !newRecipient.email.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient.email)) {
      setError('Please enter a valid email address');
      return;
    }

    const recipient: CustomRecipient = {
      id: `custom-${Date.now()}`,
      name: newRecipient.name.trim(),
      email: newRecipient.email.trim(),
    };

    setCustomRecipients((prev) => [...prev, recipient]);
    setNewRecipient({ name: '', email: '' });
    setError(null);
  }, [newRecipient]);

  // Remove custom recipient
  const handleRemoveCustomRecipient = useCallback((id: string) => {
    setCustomRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Toggle case selection
  const handleCaseToggle = useCallback((caseId: string) => {
    setSelectedCases((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  }, []);

  // Toggle case type selection
  const handleCaseTypeToggle = useCallback((typeId: string) => {
    setSelectedCaseTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Recipient Type Selection */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Recipient Type</label>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Select recipient type"
        >
          {recipientTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onRecipientTypeChange(type.value)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                recipientType === type.value
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              role="radio"
              aria-checked={recipientType === type.value}
            >
              <span
                className={`mt-0.5 ${
                  recipientType === type.value ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {getTypeIcon(type.value)}
              </span>
              <div>
                <div
                  className={`text-sm font-medium ${
                    recipientType === type.value ? 'text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {type.label}
                </div>
                <div className="text-xs text-gray-500">{type.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Options based on Type */}
      <div className="rounded-lg border border-gray-200 p-4">
        {/* Case Clients / Case Team */}
        {(recipientType === 'CaseClients' || recipientType === 'CaseTeam') && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Select Cases</label>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {MOCK_CASES.map((caseItem) => (
                <label
                  key={caseItem.id}
                  className="flex items-center gap-2 rounded p-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCases.includes(caseItem.id)}
                    onChange={() => handleCaseToggle(caseItem.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{caseItem.title}</div>
                    <div className="text-xs text-gray-500">{caseItem.caseNumber}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedCases.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                Please select at least one case
              </p>
            )}
          </div>
        )}

        {/* All Clients */}
        {recipientType === 'AllClients' && (
          <div className="text-center py-4">
            <Building className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-600">
              All active clients in your firm will receive this communication
            </p>
          </div>
        )}

        {/* Case Type Clients */}
        {recipientType === 'CaseTypeClients' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Case Types
            </label>
            <div className="flex flex-wrap gap-2">
              {MOCK_CASE_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleCaseTypeToggle(type.id)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedCaseTypes.includes(type.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.name}
                </button>
              ))}
            </div>
            {selectedCaseTypes.length === 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                Please select at least one case type
              </p>
            )}
          </div>
        )}

        {/* Custom List */}
        {recipientType === 'CustomList' && (
          <div className="space-y-4">
            {/* Add Recipient Form */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Add Recipient</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient((prev) => ({ ...prev, name: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient((prev) => ({ ...prev, email: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomRecipient();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomRecipient}
                  disabled={!newRecipient.name || !newRecipient.email}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Custom Recipients List */}
            {customRecipients.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Recipients ({customRecipients.length})
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {customRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">{recipient.name}</div>
                        <div className="text-xs text-gray-500">{recipient.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomRecipient(recipient.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        aria-label={`Remove ${recipient.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customRecipients.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                No recipients added yet. Add recipients above.
              </p>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Resolving recipients...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecipientSelector;
