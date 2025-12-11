'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { Inbox, Send, Mail } from 'lucide-react';

export function FilterBar() {
  const { filters, setFilters, clearFilters, emailViewMode, setEmailViewMode } = useCommunicationStore();

  const activeFilterCount = [
    filters.hasDeadline,
    filters.hasAttachment,
    filters.unreadOnly,
    filters.caseIds.length > 0,
    filters.senderIds.length > 0,
    filters.dateRange !== null,
  ].filter(Boolean).length;

  return (
    <div className="p-4 border-b bg-white space-y-3">
      {/* Email View Mode Tabs */}
      <div className="flex border rounded-lg overflow-hidden">
        <button
          onClick={() => setEmailViewMode('received')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm transition-colors ${
            emailViewMode === 'received'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          title="Mesaje primite"
        >
          <Inbox className="h-4 w-4" />
          <span>Primite</span>
        </button>
        <button
          onClick={() => setEmailViewMode('sent')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border-l transition-colors ${
            emailViewMode === 'sent'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          title="Mesaje trimise"
        >
          <Send className="h-4 w-4" />
          <span>Trimise</span>
        </button>
        <button
          onClick={() => setEmailViewMode('all')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border-l transition-colors ${
            emailViewMode === 'all'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          title="Toate mesajele"
        >
          <Mail className="h-4 w-4" />
          <span>Toate</span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filtre</h2>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 hover:underline"
          >
            Șterge toate ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Unread Only Toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.unreadOnly}
            onChange={(e) => setFilters({ unreadOnly: e.target.checked })}
            className="rounded"
          />
          <span>Doar necitite</span>
        </label>

        {/* Has Deadline Toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hasDeadline}
            onChange={(e) => setFilters({ hasDeadline: e.target.checked })}
            className="rounded"
          />
          <span>Cu termene</span>
        </label>

        {/* Has Attachment Toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hasAttachment}
            onChange={(e) => setFilters({ hasAttachment: e.target.checked })}
            className="rounded"
          />
          <span>Cu atașamente</span>
        </label>
      </div>
    </div>
  );
}
