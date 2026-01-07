'use client';

/**
 * TimesheetEditor Component
 * Main timesheet mode component
 *
 * Features:
 * - Requires case selection (shows prompt if none)
 * - Table view of time entries
 * - Contract-aware columns (cost only for hourly)
 * - Inline hours editing with validation and auto-save
 * - Billable checkbox with optimistic updates
 * - Totals footer with billable breakdown
 * - Toggle to show/hide team member attribution
 * - Multi-select rows and merge into combined entry
 * - Export to PDF or clipboard for invoicing
 * - Manual total override with discount calculation
 */

import { useState, useCallback, useRef } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { TimesheetHeader } from './TimesheetHeader';
import { TimesheetRow } from './TimesheetRow';
import { TimesheetTotals } from './TimesheetTotals';
import { MergedRow } from './MergedRow';
import { MergeActionBar } from './MergeActionBar';
import { MergeDialog } from './MergeDialog';
import { useTimesheetData, type TimesheetEntry } from '../../hooks/useTimesheetData';
import { useTimesheetMerge, type MergePreview } from '../../hooks/useTimesheetMerge';
import type { TimesheetFiltersValue } from './TimesheetFilters';

// ============================================================================
// GraphQL Mutation
// ============================================================================

const UPDATE_TIME_ENTRY_BILLABLE = gql`
  mutation UpdateTimeEntryBillable($id: ID!, $billable: Boolean!) {
    updateTimeEntry(id: $id, input: { billable: $billable }) {
      id
      billable
    }
  }
`;

const UPDATE_TIME_ENTRY_HOURS = gql`
  mutation UpdateTimeEntryHours($id: ID!, $hours: Float!) {
    updateTimeEntry(id: $id, input: { hours: $hours }) {
      id
      hours
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface TimesheetEditorProps {
  filters: TimesheetFiltersValue;
  showTeamMember?: boolean;
  onShowTeamMemberChange?: (value: boolean) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TimesheetEditor({
  filters,
  showTeamMember = true,
  onShowTeamMemberChange,
  className,
}: TimesheetEditorProps) {
  const { data, loading, error, refetch } = useTimesheetData(filters);

  // Track which entries are being updated (for loading state)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Optimistic local state for immediate UI feedback
  const [localEntries, setLocalEntries] = useState<TimesheetEntry[] | null>(null);

  // Shift+click range selection tracking
  const lastClickedIndexRef = useRef<number | null>(null);

  // Merge state and dialog
  const mergeHook = useTimesheetMerge(data?.entries ?? []);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);

  // Manual total override for discount
  const [manualTotal, setManualTotal] = useState<number | null>(null);

  // Update billable flag mutation
  const [updateBillable] = useMutation(UPDATE_TIME_ENTRY_BILLABLE);

  // Update hours mutation
  const [updateHours] = useMutation(UPDATE_TIME_ENTRY_HOURS);

  // Get entries to render (local state if modified, otherwise server data)
  const entries = localEntries ?? data?.entries ?? [];

  // Handle billable toggle with optimistic update
  const handleBillableChange = useCallback(
    async (entryId: string, billable: boolean, shiftKey = false) => {
      if (!data?.entries) return;

      const entryIndex = entries.findIndex((e) => e.id === entryId);
      if (entryIndex === -1) return;

      // Determine which entries to update
      let indicesToUpdate: number[] = [entryIndex];

      // Shift+click: toggle range from last clicked to current
      if (shiftKey && lastClickedIndexRef.current !== null) {
        const start = Math.min(lastClickedIndexRef.current, entryIndex);
        const end = Math.max(lastClickedIndexRef.current, entryIndex);
        indicesToUpdate = [];
        for (let i = start; i <= end; i++) {
          indicesToUpdate.push(i);
        }
      }

      // Update last clicked index
      lastClickedIndexRef.current = entryIndex;

      // Get IDs to update
      const idsToUpdate = indicesToUpdate.map((i) => entries[i].id);

      // Set loading state
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        idsToUpdate.forEach((id) => next.add(id));
        return next;
      });

      // Optimistic update
      setLocalEntries(entries.map((e) => (idsToUpdate.includes(e.id) ? { ...e, billable } : e)));

      try {
        // Execute mutations in parallel
        await Promise.all(idsToUpdate.map((id) => updateBillable({ variables: { id, billable } })));
        // Refetch and wait for cache update before clearing local state
        await refetch();
      } catch (err) {
        // Revert on error
        console.error('Failed to update billable status:', err);
      } finally {
        // Clear loading state and local entries
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          idsToUpdate.forEach((id) => next.delete(id));
          return next;
        });
        setLocalEntries(null);
      }
    },
    [data?.entries, entries, updateBillable, refetch]
  );

  // Wrapper to capture shift key
  const handleRowBillableChange = useCallback(
    (entryId: string, billable: boolean) => {
      // Access shift key from window event (set by click handler)
      const shiftKey = (window as unknown as { __lastShiftKey?: boolean }).__lastShiftKey ?? false;
      handleBillableChange(entryId, billable, shiftKey);
    },
    [handleBillableChange]
  );

  // Handle merge button click
  const handleMergeClick = useCallback(() => {
    const preview = mergeHook.createMergePreview();
    if (preview) {
      setMergePreview(preview);
      setShowMergeDialog(true);
    }
  }, [mergeHook]);

  // Handle merge confirmation
  const handleMergeConfirm = useCallback(
    (description: string) => {
      mergeHook.confirmMerge(description);
      setShowMergeDialog(false);
      setMergePreview(null);
    },
    [mergeHook]
  );

  // Handle hours change with optimistic update
  const handleHoursChange = useCallback(
    async (entryId: string, hours: number) => {
      if (!data?.entries) return;

      // Validate hours
      if (hours < 0.25 || hours > 24) {
        throw new Error('Orele trebuie să fie între 0.25 și 24');
      }

      // Round to nearest 0.25
      const roundedHours = Math.round(hours * 4) / 4;

      // Set loading state
      setUpdatingIds((prev) => new Set(prev).add(entryId));

      // Optimistic update - recalculate amount with new hours
      const entryToUpdate = entries.find((e) => e.id === entryId);
      if (entryToUpdate) {
        setLocalEntries(
          entries.map((e) =>
            e.id === entryId
              ? { ...e, hours: roundedHours, amount: roundedHours * e.hourlyRate }
              : e
          )
        );
      }

      try {
        await updateHours({ variables: { id: entryId, hours: roundedHours } });
        // Refetch and wait for cache update before clearing local state
        await refetch();
      } catch (err) {
        // Revert on error
        console.error('Failed to update hours:', err);
        throw err;
      } finally {
        // Clear loading state and local entries
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
        setLocalEntries(null);
      }
    },
    [data?.entries, entries, updateHours, refetch]
  );

  // Calculate totals from current entries (respecting optimistic updates and merged groups)
  const calculateTotals = useCallback(() => {
    if (!data?.case)
      return { totalHours: 0, totalBillableHours: 0, totalCost: 0, totalBillableCost: 0 };

    let totalHours = 0;
    let totalBillableHours = 0;
    let totalCost = 0;
    let totalBillableCost = 0;

    // Get display entries which includes merged groups
    const displayEntries = mergeHook.getDisplayEntries(entries);

    displayEntries.forEach((displayEntry) => {
      if (displayEntry.type === 'merged') {
        const { group } = displayEntry;
        totalHours += group.totalHours;
        totalCost += group.totalAmount;
        if (group.billable) {
          totalBillableHours += group.totalHours;
          totalBillableCost += group.totalAmount;
        }
      } else {
        const entry = displayEntry.entry;
        totalHours += entry.hours;
        totalCost += entry.amount;
        if (entry.billable) {
          totalBillableHours += entry.hours;
          totalBillableCost += entry.amount;
        }
      }
    });

    return { totalHours, totalBillableHours, totalCost, totalBillableCost };
  }, [data?.case, entries, mergeHook]);

  // Use calculated totals when there are local changes or merged groups
  const hasMergedGroups = mergeHook.mergedGroups.length > 0;
  const totals =
    localEntries || hasMergedGroups
      ? calculateTotals()
      : {
          totalHours: data?.totalHours ?? 0,
          totalBillableHours: data?.totalBillableHours ?? 0,
          totalCost: data?.totalCost ?? 0,
          totalBillableCost: data?.totalBillableCost ?? 0,
        };

  // Calculate discount when manual total is set
  const discount =
    manualTotal !== null && manualTotal < totals.totalBillableCost
      ? totals.totalBillableCost - manualTotal
      : 0;
  const finalTotal = manualTotal !== null ? manualTotal : totals.totalBillableCost;

  // Handle manual total change
  const handleManualTotalChange = useCallback((value: number | null) => {
    setManualTotal(value);
  }, []);

  // Get display entries for rendering
  const displayEntries = mergeHook.getDisplayEntries(entries);

  // No case selected - show prompt
  if (!filters.caseId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="p-4 bg-linear-accent/20 rounded-full mb-4">
          <FileSearch className="h-8 w-8 text-linear-accent" />
        </div>
        <h2 className="text-lg font-medium text-linear-text-primary mb-2">Selectează un dosar</h2>
        <p className="text-sm text-linear-text-muted max-w-md">
          Selectează un dosar din filtrul din stânga pentru a vedea fișa de pontaj.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <Loader2 className="h-8 w-8 text-linear-accent animate-spin mb-4" />
        <p className="text-sm text-linear-text-muted">Se încarcă datele...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="p-4 bg-linear-error/20 rounded-full mb-4">
          <FileSearch className="h-8 w-8 text-linear-error" />
        </div>
        <h2 className="text-lg font-medium text-linear-text-primary mb-2">Eroare la încărcare</h2>
        <p className="text-sm text-linear-text-muted max-w-md">{error.message}</p>
      </div>
    );
  }

  // No data
  if (!data || !data.case) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
          <FileSearch className="h-8 w-8 text-linear-text-muted" />
        </div>
        <h2 className="text-lg font-medium text-linear-text-primary mb-2">
          Dosarul nu a fost găsit
        </h2>
        <p className="text-sm text-linear-text-muted max-w-md">
          Dosarul selectat nu există sau nu aveți acces la el.
        </p>
      </div>
    );
  }

  // Build period object for export
  const period = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };

  // No entries for period
  if (data.entries.length === 0) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <TimesheetHeader
          caseData={data.case}
          showTeamMember={showTeamMember}
          onShowTeamMemberChange={onShowTeamMemberChange}
          entries={[]}
          totalHours={0}
          totalBillableHours={0}
          totalCost={0}
          totalBillableCost={0}
          period={period}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
            <FileSearch className="h-8 w-8 text-linear-text-muted" />
          </div>
          <h2 className="text-lg font-medium text-linear-text-primary mb-2">Nicio înregistrare</h2>
          <p className="text-sm text-linear-text-muted max-w-md">
            Nu există înregistrări de timp pentru perioada și filtrele selectate.
          </p>
        </div>
      </div>
    );
  }

  // Render timesheet table
  return (
    <>
      <div
        className={clsx(
          'flex flex-col h-full border border-linear-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header with contract info, export buttons, and column labels */}
        <TimesheetHeader
          caseData={data.case}
          showTeamMember={showTeamMember}
          onShowTeamMemberChange={onShowTeamMemberChange}
          entries={entries}
          totalHours={totals.totalHours}
          totalBillableHours={totals.totalBillableHours}
          totalCost={totals.totalCost}
          totalBillableCost={totals.totalBillableCost}
          period={period}
          showSelection={true}
          discount={discount}
          finalTotal={finalTotal}
        />

        {/* Scrollable entries area with shift key tracking */}
        <div
          className="flex-1 overflow-y-auto"
          onClick={(e) => {
            // Track shift key for range selection
            (window as unknown as { __lastShiftKey?: boolean }).__lastShiftKey = e.shiftKey;
          }}
        >
          {displayEntries.map((displayEntry) => {
            if (displayEntry.type === 'merged') {
              return (
                <MergedRow
                  key={displayEntry.group.id}
                  group={displayEntry.group}
                  originalEntries={displayEntry.originalEntries}
                  billingType={data.case!.billingType}
                  showTeamMember={showTeamMember}
                  showSelection={true}
                  onUnmerge={mergeHook.unmergeGroup}
                />
              );
            }
            return (
              <TimesheetRow
                key={displayEntry.entry.id}
                entry={displayEntry.entry}
                billingType={data.case!.billingType}
                showTeamMember={showTeamMember}
                onHoursChange={handleHoursChange}
                onBillableChange={handleRowBillableChange}
                isUpdating={updatingIds.has(displayEntry.entry.id)}
                showSelection={true}
                isSelected={mergeHook.isSelected(displayEntry.entry.id)}
                onSelectionChange={mergeHook.toggleSelection}
              />
            );
          })}
        </div>

        {/* Totals footer - uses optimistic totals when available */}
        <TimesheetTotals
          totalHours={totals.totalHours}
          totalBillableHours={totals.totalBillableHours}
          totalCost={totals.totalCost}
          totalBillableCost={totals.totalBillableCost}
          billingType={data.case.billingType}
          showTeamMember={showTeamMember}
          showSelection={true}
          manualTotal={manualTotal}
          onManualTotalChange={handleManualTotalChange}
          discount={discount}
        />
      </div>

      {/* Floating merge action bar */}
      <MergeActionBar
        selectedCount={mergeHook.selectedCount}
        onMerge={handleMergeClick}
        onDeselect={mergeHook.clearSelection}
      />

      {/* Merge confirmation dialog */}
      <MergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        preview={mergePreview}
        onConfirm={handleMergeConfirm}
      />
    </>
  );
}

TimesheetEditor.displayName = 'TimesheetEditor';

export default TimesheetEditor;
