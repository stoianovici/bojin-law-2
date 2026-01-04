/**
 * TaskFilterBar Component
 * Provides filtering options for task views using Linear design patterns
 */

'use client';

import React from 'react';
import type { TaskFilters } from '@legal-platform/types';
import { useFirmUsers } from '../../hooks/useFirmUsers';
import { FilterChip, FilterChipsRow, IconButton } from '@/components/linear/FilterChips';
import { X } from 'lucide-react';

/**
 * TaskFilterBar Props
 */
interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: Partial<TaskFilters>) => void;
  onClearFilters: () => void;
}

/**
 * TaskFilterBar Component
 */
export function TaskFilterBar({ filters, onFiltersChange, onClearFilters }: TaskFilterBarProps) {
  const { users: firmUsers } = useFirmUsers();
  const selectedUsers = filters.assignedTo || [];

  // Map firm users to display format
  const users = firmUsers.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    initials: `${user.firstName[0] || ''}${user.lastName[0] || ''}`.toUpperCase(),
  }));

  /**
   * Handle user chip toggle
   */
  const handleUserToggle = (userId: string) => {
    const isCurrentlySelected = selectedUsers.includes(userId);

    if (isCurrentlySelected) {
      // Remove user from filter
      const newUsers = selectedUsers.filter((id) => id !== userId);
      onFiltersChange({
        assignedTo: newUsers.length > 0 ? newUsers : undefined,
      });
    } else {
      // Add user to filter
      onFiltersChange({
        assignedTo: [...selectedUsers, userId],
      });
    }
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    (filters.assignedTo && filters.assignedTo.length > 0) ||
    (filters.types && filters.types.length > 0) ||
    (filters.statuses && filters.statuses.length > 0) ||
    (filters.priorities && filters.priorities.length > 0) ||
    filters.dateRange !== undefined ||
    (filters.searchQuery && filters.searchQuery.trim() !== '');

  return (
    <div className="bg-linear-bg-secondary border-b border-linear-border-subtle px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Filter Section */}
        <div className="flex items-center gap-4 min-w-0">
          {/* User Filter Chips */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-linear-text-tertiary shrink-0">
              Utilizatori:
            </span>
            <FilterChipsRow gap="sm">
              {users.map((user) => (
                <FilterChip
                  key={user.id}
                  selected={selectedUsers.includes(user.id)}
                  onClick={() => handleUserToggle(user.id)}
                >
                  {user.initials}
                </FilterChip>
              ))}
            </FilterChipsRow>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <IconButton onClick={onClearFilters} aria-label="Șterge toate filtrele">
            <X className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      {/* Active Filter Summary */}
      {hasActiveFilters && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-linear-text-muted">Active:</span>
          <div className="flex items-center gap-1.5">
            {selectedUsers.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-linear-accent-muted text-linear-accent text-[11px] font-medium rounded-full">
                <span>
                  {selectedUsers.length} {selectedUsers.length === 1 ? 'utilizator' : 'utilizatori'}
                </span>
                <button
                  onClick={() => onFiltersChange({ assignedTo: undefined })}
                  className="hover:text-linear-accent-hover transition-colors"
                  aria-label="Șterge filtru utilizatori"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskFilterBar;
