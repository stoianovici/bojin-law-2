'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Clock,
  Loader2,
  Check,
  Plus,
  Trash2,
  ChevronRight,
  Briefcase,
  Pencil,
  X,
} from 'lucide-react';
import { useQuery } from '@apollo/client/react';
import { Button } from '@/components/ui';
import { GET_BILLABLE_TIME_ENTRIES } from '@/graphql/queries';
import { cn } from '@/lib/utils';

// ============================================================================
// Grid Layout Constants (matching BillingOverviewPanel)
// ============================================================================

const GRID_COLUMNS = '24px 1fr 80px 80px 100px';

// ============================================================================
// Line Item Adjustment Types
// ============================================================================

interface LineItemAdjustment {
  adjustedHours?: number;
  adjustedAmount?: number; // Direct amount override (ignores rate)
}

// ============================================================================
// Types
// ============================================================================

interface BillableTimeEntry {
  id: string;
  description: string;
  hours: number;
  rateEur: number;
  date: string;
  invoiced: boolean;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  task?: {
    id: string;
    title: string;
  };
}

interface ManualLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceCreateFormProps {
  onSuccess: (invoiceId: string) => void;
  clientId: string;
  clientName: string;
  caseId?: string;
  caseName?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const getDefaultIssueDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });
}

interface CaseGroup {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  entries: BillableTimeEntry[];
  totalHours: number;
  totalAmount: number;
}

function groupEntriesByCase(entries: BillableTimeEntry[]): CaseGroup[] {
  const groups: Map<string, CaseGroup> = new Map();

  for (const entry of entries) {
    const caseId = entry.case?.id || 'no-case';
    const existing = groups.get(caseId);

    if (existing) {
      existing.entries.push(entry);
      existing.totalHours += entry.hours;
      existing.totalAmount += entry.hours * entry.rateEur;
    } else {
      groups.set(caseId, {
        caseId,
        caseNumber: entry.case?.caseNumber || '-',
        caseTitle: entry.case?.title || 'Fără dosar',
        entries: [entry],
        totalHours: entry.hours,
        totalAmount: entry.hours * entry.rateEur,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

// ============================================================================
// Component
// ============================================================================

export function InvoiceCreateForm({
  onSuccess,
  clientId,
  clientName,
  caseId,
  caseName,
}: InvoiceCreateFormProps) {
  // Period filter state
  type PeriodFilter = 'all' | 'previous-month' | 'manual';
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');

  // Local form state
  const [issueDate, setIssueDate] = useState(getDefaultIssueDate);
  const [duePeriod, setDuePeriod] = useState(30); // Days until due
  const [notes, setNotes] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<string[]>([]);
  const [manualItems, setManualItems] = useState<ManualLineItem[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  // Calculate due date from issue date + period
  const dueDate = useMemo(() => {
    const date = new Date(issueDate);
    date.setDate(date.getDate() + duePeriod);
    return date.toISOString().split('T')[0];
  }, [issueDate, duePeriod]);

  // Inline editing state
  const [adjustments, setAdjustments] = useState<Record<string, LineItemAdjustment>>({});
  const [manualTotal, setManualTotal] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{
    entryId: string;
    field: 'hours' | 'amount';
  } | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Query for billable time entries
  const { data: timeEntriesData, loading: timeEntriesLoading } = useQuery<{
    billableTimeEntries: BillableTimeEntry[];
  }>(GET_BILLABLE_TIME_ENTRIES, {
    variables: {
      clientId,
      caseId: caseId || undefined,
    },
  });

  const allTimeEntries = timeEntriesData?.billableTimeEntries || [];

  // Filter entries by period
  const unbilledEntries = useMemo(() => {
    const entries = allTimeEntries.filter((e) => !e.invoiced);

    if (periodFilter === 'all') {
      return entries;
    }

    if (periodFilter === 'previous-month') {
      const now = new Date();
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return entries.filter((e) => {
        const entryDate = new Date(e.date);
        return entryDate >= firstDayPrevMonth && entryDate <= lastDayPrevMonth;
      });
    }

    if (periodFilter === 'manual' && manualStartDate && manualEndDate) {
      const start = new Date(manualStartDate);
      const end = new Date(manualEndDate);
      return entries.filter((e) => {
        const entryDate = new Date(e.date);
        return entryDate >= start && entryDate <= end;
      });
    }

    return entries;
  }, [allTimeEntries, periodFilter, manualStartDate, manualEndDate]);

  // Group entries by case (for multi-case view)
  const groupedEntries = useMemo(() => groupEntriesByCase(unbilledEntries), [unbilledEntries]);
  const showGrouped = !caseId && groupedEntries.length >= 1;

  // Toggle case expansion
  const toggleCaseExpanded = (caseId: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  // Toggle all entries in a case group
  const toggleCaseGroupSelection = (group: CaseGroup) => {
    const groupEntryIds = group.entries.map((e) => e.id);
    const allSelected = groupEntryIds.every((id) => selectedTimeEntryIds.includes(id));

    if (allSelected) {
      setSelectedTimeEntryIds((prev) => prev.filter((id) => !groupEntryIds.includes(id)));
    } else {
      setSelectedTimeEntryIds((prev) => [...new Set([...prev, ...groupEntryIds])]);
    }
  };

  // Get effective hours/amount for an entry (with adjustments)
  const getEffectiveValues = useCallback(
    (entry: BillableTimeEntry) => {
      const adj = adjustments[entry.id];
      const hours = adj?.adjustedHours ?? entry.hours;
      const amount = adj?.adjustedAmount ?? hours * entry.rateEur;
      return { hours, amount };
    },
    [adjustments]
  );

  // Update adjustment for an entry
  const updateAdjustment = useCallback(
    (entryId: string, field: 'hours' | 'amount', value: number) => {
      setAdjustments((prev) => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          [field === 'hours' ? 'adjustedHours' : 'adjustedAmount']: value,
        },
      }));
    },
    []
  );

  // Clear adjustment for an entry
  const clearAdjustment = useCallback((entryId: string, field: 'hours' | 'amount') => {
    setAdjustments((prev) => {
      const newAdj = { ...prev };
      if (newAdj[entryId]) {
        if (field === 'hours') {
          delete newAdj[entryId].adjustedHours;
        } else {
          delete newAdj[entryId].adjustedAmount;
        }
        // Remove entry if no adjustments left
        if (!newAdj[entryId].adjustedHours && !newAdj[entryId].adjustedAmount) {
          delete newAdj[entryId];
        }
      }
      return newAdj;
    });
  }, []);

  // Start editing a cell
  const startEditing = useCallback(
    (entryId: string, field: 'hours' | 'amount', currentValue: number) => {
      setEditingCell({ entryId, field });
      setEditValue(currentValue.toString());
    },
    []
  );

  // Save cell edit
  const saveEdit = useCallback(() => {
    if (!editingCell) return;

    const parsed = parseFloat(editValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      updateAdjustment(editingCell.entryId, editingCell.field, parsed);
    }
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, updateAdjustment]);

  // Cancel cell edit
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Start editing total
  const startEditingTotal = useCallback((currentValue: number) => {
    setEditingTotal(true);
    setEditValue(formatAmount(currentValue));
  }, []);

  // Save total edit
  const saveTotalEdit = useCallback(() => {
    const parsed = parseFloat(editValue.replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      setManualTotal(parsed);
    }
    setEditingTotal(false);
    setEditValue('');
  }, [editValue]);

  // Clear manual total
  const clearManualTotal = useCallback(() => {
    setManualTotal(null);
  }, []);

  // Auto-select all unbilled entries when loaded
  useEffect(() => {
    if (unbilledEntries.length > 0 && selectedTimeEntryIds.length === 0) {
      setSelectedTimeEntryIds(unbilledEntries.map((e) => e.id));
    }
  }, [unbilledEntries.length]); // Only run when entries load

  // Reset selection when client/case changes
  useEffect(() => {
    setSelectedTimeEntryIds([]);
  }, [clientId, caseId]);

  // Mutation - TODO: Backend not implemented yet
  const [creating, setCreating] = useState(false);
  const createInvoice = async () => {
    setCreating(true);
    // TODO: Implement createPreparedInvoice mutation in gateway
    console.log('Invoice draft data:', {
      clientId,
      caseId,
      issueDate,
      dueDate,
      notes,
      internalNote,
      timeEntryIds: selectedTimeEntryIds,
      adjustments,
      manualTotal,
      finalTotal: finalTotal + manualItemsTotal,
    });
    setTimeout(() => {
      setCreating(false);
      alert('Funcționalitatea de creare factură va fi disponibilă în curând.');
    }, 500);
  };

  // Calculations (with adjustments)
  const { totalHours, totalTimeAmount, selectedCount, originalTotal } = useMemo(() => {
    const selectedEntries = unbilledEntries.filter((e) => selectedTimeEntryIds.includes(e.id));

    let hours = 0;
    let amount = 0;
    let original = 0;

    for (const entry of selectedEntries) {
      const effective = getEffectiveValues(entry);
      hours += effective.hours;
      amount += effective.amount;
      original += entry.hours * entry.rateEur;
    }

    return {
      totalHours: hours,
      totalTimeAmount: amount,
      selectedCount: selectedEntries.length,
      originalTotal: original,
    };
  }, [unbilledEntries, selectedTimeEntryIds, getEffectiveValues]);

  // Final total (with manual override)
  const finalTotal = manualTotal ?? totalTimeAmount;
  const discount = totalTimeAmount - finalTotal;
  const hasDiscount = discount > 0;

  const manualItemsTotal = manualItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const totalAmount = totalTimeAmount + manualItemsTotal;

  // Select all / deselect all
  const allSelected =
    unbilledEntries.length > 0 && selectedTimeEntryIds.length === unbilledEntries.length;
  const someSelected =
    selectedTimeEntryIds.length > 0 && selectedTimeEntryIds.length < unbilledEntries.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedTimeEntryIds([]);
    } else {
      setSelectedTimeEntryIds(unbilledEntries.map((e) => e.id));
    }
  };

  const handleToggleEntry = (entryId: string) => {
    setSelectedTimeEntryIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    );
  };

  // Manual line items
  const handleAddManualItem = () => {
    setManualItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleUpdateManualItem = (id: string, updates: Partial<ManualLineItem>) => {
    setManualItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRemoveManualItem = (id: string) => {
    setManualItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Create invoice
  const handleCreateDraft = () => {
    createInvoice();
  };

  const canCreate =
    selectedCount > 0 || manualItems.some((item) => item.description && item.unitPrice > 0);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-linear-border-subtle px-6 py-4">
        <h2 className="text-base font-medium text-linear-text-primary">{clientName}</h2>
        {caseName && <p className="text-sm text-linear-text-tertiary">{caseName}</p>}
        {!caseName && <p className="text-sm text-linear-text-tertiary">Toate dosarele</p>}

        {/* Period Filter */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-linear-text-muted">Perioada:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPeriodFilter('all')}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                periodFilter === 'all'
                  ? 'bg-linear-accent text-white'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
              )}
            >
              La zi
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('previous-month')}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                periodFilter === 'previous-month'
                  ? 'bg-linear-accent text-white'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
              )}
            >
              Luna anterioară
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('manual')}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                periodFilter === 'manual'
                  ? 'bg-linear-accent text-white'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
              )}
            >
              Manual
            </button>
          </div>
          {periodFilter === 'manual' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={manualStartDate}
                onChange={(e) => setManualStartDate(e.target.value)}
                className="rounded border border-linear-border-subtle bg-linear-bg-tertiary px-2 py-1 text-xs text-linear-text-primary"
              />
              <span className="text-xs text-linear-text-muted">—</span>
              <input
                type="date"
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
                className="rounded border border-linear-border-subtle bg-linear-bg-tertiary px-2 py-1 text-xs text-linear-text-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content - Scrollable form + sticky summary */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Time Entries - Tree Table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-linear-text-primary">Pontaje</h3>
                {unbilledEntries.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-linear-text-secondary">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="h-4 w-4 rounded border-linear-border-subtle"
                    />
                    Selectează toate ({unbilledEntries.length})
                  </label>
                )}
              </div>

              {timeEntriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-linear-accent" />
                </div>
              ) : unbilledEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-linear-border-subtle bg-linear-bg-secondary p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-linear-text-tertiary opacity-50" />
                  <p className="mt-2 text-sm text-linear-text-secondary">
                    Nu există pontaje nefacturate
                  </p>
                  <p className="mt-1 text-xs text-linear-text-tertiary">
                    Poți adăuga linii manuale mai jos
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-linear-border-subtle overflow-hidden">
                  {/* Column Headers */}
                  <div
                    className="grid gap-3 px-3 py-2 bg-linear-bg-tertiary text-xs font-medium text-linear-text-tertiary uppercase tracking-wide border-b border-linear-border-subtle"
                    style={{ gridTemplateColumns: GRID_COLUMNS }}
                  >
                    <div /> {/* Checkbox */}
                    <div>Descriere</div>
                    <div className="text-right">Data</div>
                    <div className="text-right">Ore</div>
                    <div className="text-right">Sumă</div>
                  </div>

                  {/* Subtotal Row */}
                  <div
                    className="grid gap-3 px-3 py-2 bg-linear-bg-tertiary items-center border-b border-linear-border-subtle"
                    style={{ gridTemplateColumns: GRID_COLUMNS }}
                  >
                    <div />
                    <div className="text-[13px] font-medium text-linear-text-secondary">
                      Subtotal
                    </div>
                    <div />
                    <div className="text-[13px] text-linear-text-secondary text-right tabular-nums">
                      {formatHours(totalHours)}h
                    </div>
                    <div className="text-[13px] text-linear-text-secondary text-right tabular-nums">
                      {formatAmount(totalTimeAmount)} EUR
                    </div>
                  </div>

                  {/* Discount Row (if manual total is set lower) */}
                  {hasDiscount && (
                    <div
                      className="grid gap-3 px-3 py-2 bg-green-500/10 items-center border-b border-linear-border-subtle"
                      style={{ gridTemplateColumns: GRID_COLUMNS }}
                    >
                      <div />
                      <div className="text-[13px] font-medium text-green-500">Discount</div>
                      <div />
                      <div />
                      <div className="text-[13px] font-medium text-green-500 text-right tabular-nums">
                        -{formatAmount(discount)} EUR
                      </div>
                    </div>
                  )}

                  {/* Final Total Row - Editable */}
                  <div
                    className="grid gap-3 px-3 py-2 bg-linear-accent/10 items-center border-b border-linear-border"
                    style={{ gridTemplateColumns: GRID_COLUMNS }}
                  >
                    <div />
                    <div className="text-[13px] font-bold text-linear-text-primary flex items-center gap-2">
                      TOTAL
                      {manualTotal !== null && (
                        <button
                          type="button"
                          onClick={clearManualTotal}
                          className="p-0.5 rounded-full bg-linear-bg-tertiary hover:bg-linear-bg-secondary text-linear-text-muted transition-colors"
                          title="Resetează totalul"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div />
                    <div className="text-[13px] font-bold text-linear-text-primary text-right tabular-nums">
                      {formatHours(totalHours)}h
                    </div>
                    <div className="text-[13px] font-bold text-linear-accent text-right tabular-nums">
                      {editingTotal ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveTotalEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTotalEdit();
                            if (e.key === 'Escape') {
                              setEditingTotal(false);
                              setEditValue('');
                            }
                          }}
                          className="w-full px-1 py-0.5 text-right text-[13px] font-bold text-linear-accent bg-linear-bg-secondary border border-linear-accent rounded focus:outline-none focus:ring-1 focus:ring-linear-accent tabular-nums"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingTotal(finalTotal)}
                          className="group inline-flex items-center gap-1 hover:bg-linear-accent/20 px-1 py-0.5 -mx-1 rounded transition-colors"
                          title="Click pentru a modifica totalul"
                        >
                          <span>{formatAmount(finalTotal)} EUR</span>
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Entries - Grouped or Flat */}
                  <div>
                    {showGrouped
                      ? // Grouped by case
                        groupedEntries.map((group) => {
                          const isExpanded = expandedCases.has(group.caseId);
                          const groupEntryIds = group.entries.map((e) => e.id);
                          const selectedInGroup = groupEntryIds.filter((id) =>
                            selectedTimeEntryIds.includes(id)
                          ).length;
                          const allGroupSelected = selectedInGroup === group.entries.length;
                          const someGroupSelected = selectedInGroup > 0 && !allGroupSelected;

                          return (
                            <div
                              key={group.caseId}
                              className="border-b border-linear-border-subtle last:border-b-0"
                            >
                              {/* Case Group Row */}
                              <div
                                className={cn(
                                  'grid gap-3 px-3 py-2 items-center cursor-pointer transition-colors hover:bg-linear-bg-hover',
                                  isExpanded && 'bg-linear-bg-tertiary'
                                )}
                                style={{ gridTemplateColumns: GRID_COLUMNS }}
                                onClick={() => toggleCaseExpanded(group.caseId)}
                              >
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCaseGroupSelection(group);
                                  }}
                                  className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer',
                                    allGroupSelected
                                      ? 'border-linear-accent bg-linear-accent'
                                      : someGroupSelected
                                        ? 'border-linear-accent bg-linear-accent/50'
                                        : 'border-linear-border-subtle'
                                  )}
                                >
                                  {(allGroupSelected || someGroupSelected) && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                  <ChevronRight
                                    className={cn(
                                      'h-4 w-4 text-linear-text-tertiary transition-transform flex-shrink-0',
                                      isExpanded && 'rotate-90'
                                    )}
                                  />
                                  <Briefcase className="h-3.5 w-3.5 text-linear-text-tertiary flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-[13px] font-medium text-linear-text-primary truncate block">
                                      {group.caseTitle}
                                    </span>
                                    <span className="text-[11px] text-linear-text-muted">
                                      {group.caseNumber} · {group.entries.length} pontaje
                                    </span>
                                  </div>
                                </div>
                                <div />
                                <div className="text-[13px] text-linear-text-primary text-right tabular-nums">
                                  {formatHours(group.totalHours)}h
                                </div>
                                <div className="text-[13px] font-medium text-linear-accent text-right tabular-nums">
                                  {formatAmount(group.totalAmount)}
                                </div>
                              </div>

                              {/* Expanded Entries */}
                              {isExpanded && (
                                <div className="bg-linear-bg-elevated">
                                  {group.entries.map((entry) => {
                                    const effective = getEffectiveValues(entry);
                                    const adj = adjustments[entry.id];
                                    return (
                                      <TimeEntryRow
                                        key={entry.id}
                                        entry={entry}
                                        isSelected={selectedTimeEntryIds.includes(entry.id)}
                                        onToggle={() => handleToggleEntry(entry.id)}
                                        indented
                                        effectiveHours={effective.hours}
                                        effectiveAmount={effective.amount}
                                        isHoursAdjusted={adj?.adjustedHours !== undefined}
                                        isAmountAdjusted={adj?.adjustedAmount !== undefined}
                                        editingCell={editingCell}
                                        editValue={editValue}
                                        onEditValueChange={setEditValue}
                                        onStartEditing={startEditing}
                                        onSaveEdit={saveEdit}
                                        onCancelEdit={cancelEdit}
                                        onClearAdjustment={clearAdjustment}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      : // Flat list (single case or all from same case)
                        unbilledEntries.map((entry) => {
                          const effective = getEffectiveValues(entry);
                          const adj = adjustments[entry.id];
                          return (
                            <TimeEntryRow
                              key={entry.id}
                              entry={entry}
                              isSelected={selectedTimeEntryIds.includes(entry.id)}
                              onToggle={() => handleToggleEntry(entry.id)}
                              indented={false}
                              effectiveHours={effective.hours}
                              effectiveAmount={effective.amount}
                              isHoursAdjusted={adj?.adjustedHours !== undefined}
                              isAmountAdjusted={adj?.adjustedAmount !== undefined}
                              editingCell={editingCell}
                              editValue={editValue}
                              onEditValueChange={setEditValue}
                              onStartEditing={startEditing}
                              onSaveEdit={saveEdit}
                              onCancelEdit={cancelEdit}
                              onClearAdjustment={clearAdjustment}
                            />
                          );
                        })}
                  </div>
                </div>
              )}
            </section>

            {/* Manual Line Items */}
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-linear-text-primary">Linii manuale</h3>
                <button
                  onClick={handleAddManualItem}
                  className="flex items-center gap-1 text-xs text-linear-accent hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Adaugă linie
                </button>
              </div>

              {manualItems.length === 0 ? (
                <p className="mt-2 text-xs text-linear-text-tertiary">
                  Opțional: adaugă cheltuieli sau servicii suplimentare
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {manualItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-linear-border-subtle p-3"
                    >
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Descriere"
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateManualItem(item.id, { description: e.target.value })
                          }
                          className="w-full rounded border border-linear-border-subtle bg-linear-bg-secondary px-2 py-1.5 text-sm text-linear-text-primary placeholder:text-linear-text-tertiary"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Cantitate"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              handleUpdateManualItem(item.id, {
                                quantity: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-24 rounded border border-linear-border-subtle bg-linear-bg-secondary px-2 py-1.5 text-sm text-linear-text-primary"
                          />
                          <input
                            type="number"
                            placeholder="Preț unitar (EUR)"
                            value={item.unitPrice || ''}
                            onChange={(e) =>
                              handleUpdateManualItem(item.id, {
                                unitPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="flex-1 rounded border border-linear-border-subtle bg-linear-bg-secondary px-2 py-1.5 text-sm text-linear-text-primary"
                          />
                          <span className="flex items-center text-sm font-medium text-linear-text-primary">
                            {(item.quantity * item.unitPrice).toFixed(2)} EUR
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveManualItem(item.id)}
                        className="p-1 text-linear-text-tertiary hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-sm font-medium text-linear-text-primary">Notițe</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-linear-text-tertiary">
                    Notițe factură (vizibile pe factură)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Vă mulțumim pentru colaborare..."
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-2 text-sm text-linear-text-primary placeholder:text-linear-text-tertiary"
                  />
                </div>
                <div>
                  <label className="text-xs text-linear-text-tertiary">
                    Notițe interne (nu apar pe factură)
                  </label>
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Ex: Discounturi aplicate..."
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-2 text-sm text-linear-text-primary placeholder:text-linear-text-tertiary"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Summary Sidebar */}
        <aside className="w-56 flex-shrink-0 border-l border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="text-sm font-medium text-linear-text-primary">Sumar</h3>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-xs text-linear-text-tertiary">Data emiterii</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 w-full rounded border border-linear-border-subtle bg-linear-bg-tertiary px-2 py-1.5 text-sm text-linear-text-primary"
              />
            </div>
            <div>
              <label className="text-xs text-linear-text-tertiary">Scadență</label>
              <div className="mt-1 flex gap-1">
                {[1, 7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDuePeriod(days)}
                    className={cn(
                      'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                      duePeriod === days
                        ? 'bg-linear-accent text-white'
                        : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
                    )}
                  >
                    {days}z
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-linear-text-muted">{dueDate}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-linear-border-subtle pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Pontaje</span>
              <span className="text-linear-text-primary">
                {selectedCount} ({formatHours(totalHours)}h)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Subtotal pontaje</span>
              <span className="text-linear-text-primary">{formatAmount(totalTimeAmount)} EUR</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between">
                <span className="text-green-500">Discount</span>
                <span className="text-green-500">-{formatAmount(discount)} EUR</span>
              </div>
            )}
            {manualItems.length > 0 && (
              <div className="flex justify-between">
                <span className="text-linear-text-tertiary">Linii manuale</span>
                <span className="text-linear-text-primary">
                  {formatAmount(manualItemsTotal)} EUR
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-linear-border-subtle pt-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-linear-text-primary">Total</span>
              <span className="text-lg font-semibold text-linear-accent">
                {formatAmount(finalTotal + manualItemsTotal)} EUR
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleCreateDraft}
              disabled={!canCreate || creating}
              className="w-full"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se creează...
                </>
              ) : (
                'Salvează ciornă'
              )}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================================
// Time Entry Row Component
// ============================================================================

interface TimeEntryRowProps {
  entry: BillableTimeEntry;
  isSelected: boolean;
  onToggle: () => void;
  indented?: boolean;
  effectiveHours: number;
  effectiveAmount: number;
  isHoursAdjusted: boolean;
  isAmountAdjusted: boolean;
  editingCell: { entryId: string; field: 'hours' | 'amount' } | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (entryId: string, field: 'hours' | 'amount', value: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onClearAdjustment: (entryId: string, field: 'hours' | 'amount') => void;
}

function TimeEntryRow({
  entry,
  isSelected,
  onToggle,
  indented = false,
  effectiveHours,
  effectiveAmount,
  isHoursAdjusted,
  isAmountAdjusted,
  editingCell,
  editValue,
  onEditValueChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onClearAdjustment,
}: TimeEntryRowProps) {
  const isEditingHours = editingCell?.entryId === entry.id && editingCell?.field === 'hours';
  const isEditingAmount = editingCell?.entryId === entry.id && editingCell?.field === 'amount';

  return (
    <div
      className={cn(
        'grid gap-3 px-3 py-2 items-center transition-colors border-b border-linear-border-subtle last:border-b-0',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent/5'
      )}
      style={{ gridTemplateColumns: GRID_COLUMNS }}
    >
      {/* Checkbox */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer',
          isSelected ? 'border-linear-accent bg-linear-accent' : 'border-linear-border-subtle'
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Description */}
      <div className={cn('min-w-0', indented && 'pl-6')}>
        <span className="text-[13px] text-linear-text-primary truncate block">
          {entry.description}
        </span>
        {entry.user && (
          <span className="text-[11px] text-linear-text-muted">
            {entry.user.firstName} {entry.user.lastName}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="text-[13px] text-linear-text-secondary text-right">
        {formatDate(entry.date)}
      </div>

      {/* Hours - Editable */}
      <div className="text-[13px] text-right tabular-nums">
        {isEditingHours ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="w-full px-1 py-0.5 text-right text-[13px] bg-linear-bg-secondary border border-linear-accent rounded focus:outline-none tabular-nums"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEditing(entry.id, 'hours', effectiveHours);
            }}
            className={cn(
              'group inline-flex items-center gap-1 hover:bg-linear-bg-tertiary px-1 py-0.5 -mx-1 rounded transition-colors',
              isHoursAdjusted && 'text-amber-500'
            )}
          >
            <span>{formatHours(effectiveHours)}h</span>
            {isHoursAdjusted ? (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAdjustment(entry.id, 'hours');
                }}
              />
            ) : (
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </button>
        )}
      </div>

      {/* Amount - Editable */}
      <div className="text-[13px] text-right tabular-nums">
        {isEditingAmount ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="w-full px-1 py-0.5 text-right text-[13px] bg-linear-bg-secondary border border-linear-accent rounded focus:outline-none tabular-nums"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEditing(entry.id, 'amount', effectiveAmount);
            }}
            className={cn(
              'group inline-flex items-center gap-1 hover:bg-linear-bg-tertiary px-1 py-0.5 -mx-1 rounded transition-colors',
              isAmountAdjusted && 'text-amber-500'
            )}
          >
            <span>{formatAmount(effectiveAmount)}</span>
            {isAmountAdjusted ? (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAdjustment(entry.id, 'amount');
                }}
              />
            ) : (
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
