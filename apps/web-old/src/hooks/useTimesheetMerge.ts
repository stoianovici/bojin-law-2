/**
 * Timesheet Merge Hook
 * OPS-277: Virtual row merge functionality for cleaner client invoices
 *
 * Provides:
 * - Row selection state management
 * - Merge group creation (virtual, frontend-only)
 * - Un-merge capability
 * - Shift+click range selection
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { TimesheetEntry } from './useTimesheetData';

// ============================================================================
// Types
// ============================================================================

export interface MergedGroup {
  id: string; // Temporary ID for the merged group
  entryIds: string[]; // IDs of the original entries
  customDescription: string; // User-edited combined description
  totalHours: number; // Sum of hours
  totalAmount: number; // Sum of amounts
  date: string; // Earliest date from selection
  billable: boolean; // All merged entries must be billable
}

export interface UseTimesheetMergeResult {
  // Selection state
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string, shiftKey?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectedCount: number;

  // Merge state
  mergedGroups: MergedGroup[];
  canMerge: boolean; // 2+ selected

  // Merge actions
  createMergePreview: () => MergePreview | null;
  confirmMerge: (description: string) => void;
  unmergeGroup: (groupId: string) => void;

  // For rendering
  getDisplayEntries: (entries: TimesheetEntry[]) => DisplayEntry[];
  getMergedGroupTotals: () => { hours: number; amount: number };
}

export interface MergePreview {
  entryIds: string[];
  entries: TimesheetEntry[];
  totalHours: number;
  totalAmount: number;
  suggestedDescription: string;
  earliestDate: string;
}

export type DisplayEntry =
  | { type: 'entry'; entry: TimesheetEntry }
  | { type: 'merged'; group: MergedGroup; originalEntries: TimesheetEntry[] };

// ============================================================================
// Helper Functions
// ============================================================================

function generateMergeId(): string {
  return `merge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function findEarliestDate(dates: string[]): string {
  return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

// ============================================================================
// Hook
// ============================================================================

export function useTimesheetMerge(entries: TimesheetEntry[]): UseTimesheetMergeResult {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  // Merged groups state
  const [mergedGroups, setMergedGroups] = useState<MergedGroup[]>([]);

  // Build lookup of entry IDs that are part of a merged group
  const mergedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    mergedGroups.forEach((group) => {
      group.entryIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [mergedGroups]);

  // Get entries that aren't merged (available for selection)
  const availableEntries = useMemo(() => {
    return entries.filter((e) => !mergedEntryIds.has(e.id));
  }, [entries, mergedEntryIds]);

  // ============================================================================
  // Selection Actions
  // ============================================================================

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleSelection = useCallback(
    (id: string, shiftKey = false) => {
      const entryIndex = availableEntries.findIndex((e) => e.id === id);
      if (entryIndex === -1) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedIndexRef.current !== null) {
          // Shift+click: select range
          const start = Math.min(lastClickedIndexRef.current, entryIndex);
          const end = Math.max(lastClickedIndexRef.current, entryIndex);

          for (let i = start; i <= end; i++) {
            next.add(availableEntries[i].id);
          }
        } else {
          // Normal click: toggle single
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });

      lastClickedIndexRef.current = entryIndex;
    },
    [availableEntries]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(availableEntries.map((e) => e.id)));
  }, [availableEntries]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  }, []);

  // ============================================================================
  // Merge Actions
  // ============================================================================

  const canMerge = selectedIds.size >= 2;

  const createMergePreview = useCallback((): MergePreview | null => {
    if (!canMerge) return null;

    const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
    if (selectedEntries.length < 2) return null;

    const totalHours = selectedEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalAmount = selectedEntries.reduce((sum, e) => sum + e.amount, 0);
    const dates = selectedEntries.map((e) => e.date);
    const earliestDate = findEarliestDate(dates);

    // Suggest description from first entry
    const firstEntry = selectedEntries[0];
    const suggestedDescription = firstEntry.task
      ? `${firstEntry.task.title}: ${firstEntry.description}`
      : firstEntry.description;

    return {
      entryIds: Array.from(selectedIds),
      entries: selectedEntries,
      totalHours,
      totalAmount,
      suggestedDescription,
      earliestDate,
    };
  }, [canMerge, entries, selectedIds]);

  const confirmMerge = useCallback(
    (description: string) => {
      const preview = createMergePreview();
      if (!preview) return;

      // Check if all entries are billable
      const allBillable = preview.entries.every((e) => e.billable);

      const newGroup: MergedGroup = {
        id: generateMergeId(),
        entryIds: preview.entryIds,
        customDescription: description,
        totalHours: preview.totalHours,
        totalAmount: preview.totalAmount,
        date: preview.earliestDate,
        billable: allBillable,
      };

      setMergedGroups((prev) => [...prev, newGroup]);
      clearSelection();
    },
    [createMergePreview, clearSelection]
  );

  const unmergeGroup = useCallback((groupId: string) => {
    setMergedGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  // ============================================================================
  // Display Helpers
  // ============================================================================

  const getDisplayEntries = useCallback(
    (allEntries: TimesheetEntry[]): DisplayEntry[] => {
      const result: DisplayEntry[] = [];
      const processedIds = new Set<string>();

      // First, add merged groups in order of their earliest date
      const sortedGroups = [...mergedGroups].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedGroups.forEach((group) => {
        const originalEntries = allEntries.filter((e) => group.entryIds.includes(e.id));
        result.push({ type: 'merged', group, originalEntries });
        group.entryIds.forEach((id) => processedIds.add(id));
      });

      // Then add un-merged entries
      allEntries.forEach((entry) => {
        if (!processedIds.has(entry.id)) {
          result.push({ type: 'entry', entry });
        }
      });

      // Sort by date (merged groups use their earliest date)
      result.sort((a, b) => {
        const dateA = a.type === 'merged' ? a.group.date : a.entry.date;
        const dateB = b.type === 'merged' ? b.group.date : b.entry.date;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      return result;
    },
    [mergedGroups]
  );

  const getMergedGroupTotals = useCallback(() => {
    return mergedGroups.reduce(
      (acc, group) => ({
        hours: acc.hours + group.totalHours,
        amount: acc.amount + group.totalAmount,
      }),
      { hours: 0, amount: 0 }
    );
  }, [mergedGroups]);

  return {
    // Selection state
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size,

    // Merge state
    mergedGroups,
    canMerge,

    // Merge actions
    createMergePreview,
    confirmMerge,
    unmergeGroup,

    // Display helpers
    getDisplayEntries,
    getMergedGroupTotals,
  };
}

export default useTimesheetMerge;
