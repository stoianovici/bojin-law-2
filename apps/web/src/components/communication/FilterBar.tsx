'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';

export function FilterBar() {
  const { filters, setFilters, clearFilters } = useCommunicationStore();

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
