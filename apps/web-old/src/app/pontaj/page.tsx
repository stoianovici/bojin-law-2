/**
 * Time Tracking (Pontaj) Page
 * OPS-362: Linear-style time tracking with week picker and grouped entries
 *
 * Features:
 * - Week picker for period selection
 * - Grouped table by day with daily totals
 * - Weekly total display
 * - Add time entry modal
 * - Inline edit and delete
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { PageLayout, PageHeader, PageContent } from '@/components/linear/PageLayout';
import {
  GroupedTable,
  type GroupDef,
  type GroupedColumnDef,
} from '@/components/linear/GroupedTable';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/linear/StatusDot';
import { FormModal, FormGroup, FormRow } from '@/components/linear/FormModal';
import { ConfirmDialog } from '@/components/linear/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_MY_TIME_ENTRIES = gql`
  query GetMyTimeEntries($dateFrom: DateTime!, $dateTo: DateTime!) {
    myTimeEntries(filters: { dateFrom: $dateFrom, dateTo: $dateTo }) {
      id
      date
      hours
      description
      billable
      case {
        id
        title
        caseNumber
      }
      task {
        id
        title
      }
    }
    weeklySummary(weekStart: $dateFrom) {
      totalHours
      billableHours
      nonBillableHours
      billableAmount
    }
  }
`;

const CREATE_TIME_ENTRY = gql`
  mutation CreateTimeEntry($input: CreateTimeEntryInput!) {
    createTimeEntry(input: $input) {
      id
      date
      hours
      description
      billable
      case {
        id
        title
        caseNumber
      }
    }
  }
`;

const UPDATE_TIME_ENTRY = gql`
  mutation UpdateTimeEntry($id: ID!, $input: UpdateTimeEntryInput!) {
    updateTimeEntry(id: $id, input: $input) {
      id
      date
      hours
      description
      billable
    }
  }
`;

const DELETE_TIME_ENTRY = gql`
  mutation DeleteTimeEntry($id: ID!) {
    deleteTimeEntry(id: $id)
  }
`;

const GET_MY_CASES = gql`
  query GetMyCasesForTimeEntry {
    myCases(first: 50, filters: { status: ACTIVE }) {
      edges {
        node {
          id
          title
          caseNumber
        }
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  case: {
    id: string;
    title: string;
    caseNumber: string;
  };
  task?: {
    id: string;
    title: string;
  } | null;
}

interface WeeklySummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount?: number | null;
}

interface CaseOption {
  id: string;
  title: string;
  caseNumber: string;
}

// ============================================================================
// Week Navigation Helpers
// ============================================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust to Monday (day 1). If Sunday (0), go back 6 days
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startMonth = weekStart.toLocaleDateString('ro-RO', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('ro-RO', { month: 'short' });

  if (startMonth === endMonth) {
    return `${weekStart.getDate()} - ${weekEnd.getDate()} ${startMonth} ${weekStart.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${startMonth} - ${weekEnd.getDate()} ${endMonth} ${weekStart.getFullYear()}`;
}

function formatDayLabel(date: Date): string {
  const dayName = date.toLocaleDateString('ro-RO', { weekday: 'long' });
  const dayNum = date.getDate();
  const month = date.toLocaleDateString('ro-RO', { month: 'short' });
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dayNum} ${month}`;
}

// ============================================================================
// WeekPicker Component
// ============================================================================

interface WeekPickerProps {
  weekStart: Date;
  onChange: (weekStart: Date) => void;
}

function WeekPicker({ weekStart, onChange }: WeekPickerProps) {
  const goToPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    onChange(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    onChange(next);
  };

  const goToToday = () => {
    onChange(getWeekStart(new Date()));
  };

  const isCurrentWeek = getWeekStart(new Date()).getTime() === weekStart.getTime();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
        <button
          type="button"
          onClick={goToPrevWeek}
          className="flex h-9 w-9 items-center justify-center text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 px-3">
          <Calendar className="h-4 w-4 text-linear-text-tertiary" />
          <span className="text-sm font-medium text-linear-text-primary">
            {formatWeekRange(weekStart)}
          </span>
        </div>
        <button
          type="button"
          onClick={goToNextWeek}
          className="flex h-9 w-9 items-center justify-center text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isCurrentWeek && (
        <button
          type="button"
          onClick={goToToday}
          className="text-xs font-medium text-linear-text-tertiary transition-colors hover:text-linear-accent"
        >
          Această săptămână
        </button>
      )}
    </div>
  );
}

// ============================================================================
// WeeklyTotals Component
// ============================================================================

interface WeeklyTotalsProps {
  summary?: WeeklySummary | null;
  loading?: boolean;
}

function WeeklyTotals({ summary, loading }: WeeklyTotalsProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-6 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-linear-bg-tertiary" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 animate-pulse rounded bg-linear-bg-tertiary" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="flex items-center gap-6 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-5 py-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-linear-text-tertiary" />
        <span className="text-sm text-linear-text-secondary">Total:</span>
        <span className="font-mono text-sm font-semibold text-linear-text-primary">
          {summary.totalHours.toFixed(1)}h
        </span>
      </div>
      <div className="h-4 w-px bg-linear-border-subtle" />
      <div className="flex items-center gap-2">
        <StatusDot status="active" size="sm" />
        <span className="text-sm text-linear-text-secondary">Facturabil:</span>
        <span className="font-mono text-sm font-medium text-linear-success">
          {summary.billableHours.toFixed(1)}h
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status="neutral" size="sm" />
        <span className="text-sm text-linear-text-secondary">Non-facturabil:</span>
        <span className="font-mono text-sm text-linear-text-tertiary">
          {summary.nonBillableHours.toFixed(1)}h
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// AddTimeEntryModal Component
// ============================================================================

interface AddTimeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  cases: CaseOption[];
  defaultDate?: Date;
}

function AddTimeEntryModal({
  open,
  onOpenChange,
  onSuccess,
  cases,
  defaultDate,
}: AddTimeEntryModalProps) {
  const [caseId, setCaseId] = useState('');
  const [date, setDate] = useState((defaultDate ?? new Date()).toISOString().split('T')[0]);
  const [hours, setHours] = useState('1.0');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

  const [createTimeEntry, { loading }] = useMutation(CREATE_TIME_ENTRY);

  const resetForm = useCallback(() => {
    setCaseId('');
    setDate((defaultDate ?? new Date()).toISOString().split('T')[0]);
    setHours('1.0');
    setDescription('');
    setBillable(true);
  }, [defaultDate]);

  const handleSubmit = async () => {
    if (!caseId || !description.trim()) return;

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) return;

    try {
      await createTimeEntry({
        variables: {
          input: {
            caseId,
            date: new Date(date).toISOString(),
            hours: parsedHours,
            description: description.trim(),
            billable,
          },
        },
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create time entry:', error);
    }
  };

  const handleHoursIncrement = (delta: number) => {
    const current = parseFloat(hours) || 0;
    const newValue = Math.max(0.25, Math.min(24, current + delta));
    setHours(newValue.toFixed(2));
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă timp"
      submitLabel="Salvează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <FormGroup label="Dosar">
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className={cn(
            'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5',
            'text-sm text-linear-text-primary',
            'focus:border-linear-accent focus:outline-none focus:ring-2 focus:ring-linear-accent/20'
          )}
        >
          <option value="">Selectează un dosar...</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseNumber} - {c.title}
            </option>
          ))}
        </select>
      </FormGroup>

      <FormRow>
        <FormGroup label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormGroup>
        <FormGroup label="Ore">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleHoursIncrement(-0.25)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              -
            </button>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              step="0.25"
              min="0.25"
              max="24"
              className="text-center font-mono"
            />
            <button
              type="button"
              onClick={() => handleHoursIncrement(0.25)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              +
            </button>
          </div>
        </FormGroup>
      </FormRow>

      <FormGroup label="Descriere">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ce ai lucrat..."
          rows={3}
        />
      </FormGroup>

      <FormGroup>
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={billable}
            onCheckedChange={(checked) => setBillable(checked === true)}
          />
          <span className="text-sm text-linear-text-primary">Timp facturabil</span>
        </label>
      </FormGroup>
    </FormModal>
  );
}

// ============================================================================
// EditTimeEntryModal Component
// ============================================================================

interface EditTimeEntryModalProps {
  entry: TimeEntry | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function EditTimeEntryModal({ entry, onOpenChange, onSuccess }: EditTimeEntryModalProps) {
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('1.0');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

  const [updateTimeEntry, { loading }] = useMutation(UPDATE_TIME_ENTRY);

  // Populate form when entry changes
  useEffect(() => {
    if (entry) {
      setDate(new Date(entry.date).toISOString().split('T')[0]);
      setHours(entry.hours.toString());
      setDescription(entry.description);
      setBillable(entry.billable);
    }
  }, [entry]);

  const handleSubmit = async () => {
    if (!entry || !description.trim()) return;

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) return;

    try {
      await updateTimeEntry({
        variables: {
          id: entry.id,
          input: {
            date: new Date(date).toISOString(),
            hours: parsedHours,
            description: description.trim(),
            billable,
          },
        },
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update time entry:', error);
    }
  };

  const handleHoursIncrement = (delta: number) => {
    const current = parseFloat(hours) || 0;
    const newValue = Math.max(0.25, Math.min(24, current + delta));
    setHours(newValue.toFixed(2));
  };

  return (
    <FormModal
      open={entry !== null}
      onOpenChange={onOpenChange}
      title="Editează timp"
      submitLabel="Salvează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      {entry && (
        <>
          <FormGroup label="Dosar">
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5 text-sm text-linear-text-secondary">
              <span className="font-mono text-linear-accent">{entry.case.caseNumber}</span>
              <span className="ml-2">{entry.case.title}</span>
            </div>
          </FormGroup>

          <FormRow>
            <FormGroup label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormGroup>
            <FormGroup label="Ore">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleHoursIncrement(-0.25)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
                >
                  -
                </button>
                <Input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  step="0.25"
                  min="0.25"
                  max="24"
                  className="text-center font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleHoursIncrement(0.25)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
                >
                  +
                </button>
              </div>
            </FormGroup>
          </FormRow>

          <FormGroup label="Descriere">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce ai lucrat..."
              rows={3}
            />
          </FormGroup>

          <FormGroup>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={billable}
                onCheckedChange={(checked) => setBillable(checked === true)}
              />
              <span className="text-sm text-linear-text-primary">Timp facturabil</span>
            </label>
          </FormGroup>
        </>
      )}
    </FormModal>
  );
}

// ============================================================================
// TimeEntryRow Actions
// ============================================================================

interface TimeEntryActionsProps {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

function TimeEntryActions({ entry, onEdit, onDelete }: TimeEntryActionsProps) {
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={() => onEdit(entry)}
        className="rounded p-1.5 text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        title="Editează"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry)}
        className="rounded p-1.5 text-linear-text-tertiary transition-colors hover:bg-linear-error/10 hover:text-linear-error"
        title="Șterge"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PontajPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; entry: TimeEntry | null }>({
    open: false,
    entry: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);

  // Fetch time entries
  const { data, loading, refetch } = useQuery(GET_MY_TIME_ENTRIES, {
    variables: {
      dateFrom: weekStart.toISOString(),
      dateTo: weekEnd.toISOString(),
    },
    fetchPolicy: 'cache-and-network',
  });

  // Fetch cases for the modal
  const { data: casesData } = useQuery(GET_MY_CASES);

  // Mutations
  const [deleteTimeEntry] = useMutation(DELETE_TIME_ENTRY);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: TimeEntry[] = (data as any)?.myTimeEntries ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: WeeklySummary | null = (data as any)?.weeklySummary ?? null;
  const cases: CaseOption[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (casesData as any)?.myCases?.edges?.map((e: { node: CaseOption }) => e.node) ?? [];
  }, [casesData]);

  // Group entries by day
  const groupedEntries = useMemo(() => {
    // Create groups for each day of the week
    const groups: GroupDef<TimeEntry>[] = [];
    const entriesByDay = new Map<string, TimeEntry[]>();

    // Initialize all days of the week
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      entriesByDay.set(key, []);
    }

    // Assign entries to days
    entries.forEach((entry) => {
      const key = new Date(entry.date).toISOString().split('T')[0];
      const dayEntries = entriesByDay.get(key);
      if (dayEntries) {
        dayEntries.push(entry);
      }
    });

    // Build groups with daily totals
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const dayEntries = entriesByDay.get(key) ?? [];

      groups.push({
        id: key,
        label: formatDayLabel(d),
        items: dayEntries,
        defaultCollapsed: dayEntries.length === 0,
      });
    }

    return groups;
  }, [entries, weekStart]);

  // Handle edit
  const handleEdit = useCallback((entry: TimeEntry) => {
    setEditingEntry(entry);
  }, []);

  // Handle delete - opens confirm dialog
  const handleDelete = useCallback((entry: TimeEntry) => {
    setDeleteConfirm({ open: true, entry });
  }, []);

  // Perform actual delete
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm.entry) return;

    setDeleteLoading(true);
    try {
      await deleteTimeEntry({ variables: { id: deleteConfirm.entry.id } });
      setDeleteConfirm({ open: false, entry: null });
      refetch();
    } catch (error) {
      console.error('Failed to delete time entry:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteConfirm.entry, deleteTimeEntry, refetch]);

  // Custom group header with daily total
  const renderGroupHeader = useCallback((group: GroupDef<TimeEntry>, isOpen: boolean) => {
    const totalHours = group.items.reduce((sum, e) => sum + e.hours, 0);

    return (
      <>
        <span
          className={cn(
            'text-linear-text-muted transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        >
          ▶
        </span>
        <span className="text-[12px] font-medium text-linear-text-secondary">{group.label}</span>
        {group.items.length > 0 && (
          <>
            <span className="text-[11px] text-linear-text-muted">
              {group.items.length} {group.items.length === 1 ? 'înregistrare' : 'înregistrări'}
            </span>
            <span className="ml-auto font-mono text-[11px] font-medium text-linear-text-primary">
              {totalHours.toFixed(1)}h
            </span>
          </>
        )}
        {group.items.length === 0 && (
          <span className="text-[11px] text-linear-text-muted">fără înregistrări</span>
        )}
      </>
    );
  }, []);

  // Table columns
  const columns: GroupedColumnDef<TimeEntry>[] = useMemo(
    () => [
      {
        id: 'case',
        header: 'Dosar',
        width: '25%',
        accessor: (row) => (
          <div>
            <span className="font-mono text-xs text-linear-accent">{row.case.caseNumber}</span>
            <span className="ml-2 text-sm text-linear-text-primary">{row.case.title}</span>
          </div>
        ),
      },
      {
        id: 'description',
        header: 'Activitate',
        accessor: (row) => (
          <span className="text-sm text-linear-text-secondary line-clamp-1">{row.description}</span>
        ),
      },
      {
        id: 'hours',
        header: 'Ore',
        width: '80px',
        align: 'right',
        accessor: (row) => (
          <span className="font-mono text-sm text-linear-text-primary">
            {row.hours.toFixed(1)}h
          </span>
        ),
      },
      {
        id: 'billable',
        header: 'Factură',
        width: '80px',
        align: 'center',
        accessor: (row) => (
          <StatusDot
            status={row.billable ? 'active' : 'neutral'}
            size="sm"
            label={row.billable ? 'Da' : 'Nu'}
          />
        ),
      },
      {
        id: 'actions',
        width: '80px',
        align: 'right',
        cellClassName: 'group',
        accessor: (row) => (
          <TimeEntryActions entry={row} onEdit={handleEdit} onDelete={handleDelete} />
        ),
      },
    ],
    [handleEdit, handleDelete]
  );

  return (
    <PageLayout>
      {/* Page Header */}
      <PageHeader
        title="Pontaj"
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adaugă timp
          </Button>
        }
      />

      <PageContent className="mt-6 space-y-6">
        {/* Week Picker and Totals */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          <WeeklyTotals summary={summary} loading={loading && !data} />
        </div>

        {/* Time Entries Table */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <GroupedTable
            columns={columns}
            groups={groupedEntries}
            getRowKey={(row) => row.id}
            loading={loading && !data}
            showHeaders
            renderGroupHeader={renderGroupHeader}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-linear-text-muted" />
                <h3 className="mt-4 text-base font-medium text-linear-text-primary">
                  Nicio înregistrare
                </h3>
                <p className="mt-1 text-sm text-linear-text-tertiary">
                  Nu ai înregistrat timp în această săptămână.
                </p>
                <Button variant="primary" className="mt-4" onClick={() => setIsModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adaugă timp
                </Button>
              </div>
            }
          />
        </div>
      </PageContent>

      {/* Add Time Entry Modal */}
      <AddTimeEntryModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={() => refetch()}
        cases={cases}
        defaultDate={weekStart}
      />

      {/* Edit Time Entry Modal */}
      <EditTimeEntryModal
        entry={editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSuccess={() => refetch()}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => !open && setDeleteConfirm({ open: false, entry: null })}
        title="Șterge înregistrare"
        description={
          deleteConfirm.entry
            ? `Sigur vrei să ștergi înregistrarea "${deleteConfirm.entry.description}"?`
            : ''
        }
        actionLabel="Șterge"
        severity="danger"
        onAction={handleConfirmDelete}
        loading={deleteLoading}
      />
    </PageLayout>
  );
}
