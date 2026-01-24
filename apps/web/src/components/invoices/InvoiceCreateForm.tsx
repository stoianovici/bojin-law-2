'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button } from '@/components/ui';
import { GET_BILLABLE_TIME_ENTRIES } from '@/graphql/queries';
import { CREATE_PREPARED_INVOICE } from '@/graphql/mutations';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CreatePreparedInvoiceInput {
  clientId: string;
  caseId?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  internalNote?: string;
  timeEntryIds: string[];
  lineItemAdjustments: Array<{
    timeEntryId: string;
    adjustedHours?: number;
    adjustedRate?: number;
    description?: string;
  }>;
}

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

const getDefaultDueDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

const getDefaultIssueDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

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
  // Local form state
  const [issueDate, setIssueDate] = useState(getDefaultIssueDate);
  const [dueDate, setDueDate] = useState(getDefaultDueDate);
  const [notes, setNotes] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<string[]>([]);
  const [manualItems, setManualItems] = useState<ManualLineItem[]>([]);

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
  const unbilledEntries = allTimeEntries.filter((e) => !e.invoiced);

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

  // Mutation
  const [createInvoice, { loading: creating }] = useMutation<{
    createPreparedInvoice: { id: string };
  }>(CREATE_PREPARED_INVOICE, {
    onCompleted: (data) => {
      onSuccess(data.createPreparedInvoice.id);
    },
    onError: (error) => {
      console.error('Failed to create invoice:', error.message);
    },
  });

  // Calculations
  const { totalHours, totalTimeAmount, selectedCount } = useMemo(() => {
    const selectedEntries = unbilledEntries.filter((e) => selectedTimeEntryIds.includes(e.id));

    return {
      totalHours: selectedEntries.reduce((sum, e) => sum + e.hours, 0),
      totalTimeAmount: selectedEntries.reduce((sum, e) => sum + e.hours * e.rateEur, 0),
      selectedCount: selectedEntries.length,
    };
  }, [unbilledEntries, selectedTimeEntryIds]);

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
    const input: CreatePreparedInvoiceInput = {
      clientId,
      caseId: caseId || undefined,
      issueDate,
      dueDate,
      notes: notes || undefined,
      internalNote: internalNote || undefined,
      timeEntryIds: selectedTimeEntryIds,
      lineItemAdjustments: [],
    };

    createInvoice({ variables: { input } });
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
      </div>

      {/* Content - Scrollable form + sticky summary */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Dates */}
            <section>
              <h3 className="text-sm font-medium text-linear-text-primary">Date factură</h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-linear-text-tertiary">Data emiterii</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-2 text-sm text-linear-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-linear-text-tertiary">Scadență</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-2 text-sm text-linear-text-primary"
                  />
                </div>
              </div>
            </section>

            {/* Time Entries */}
            <section>
              <div className="flex items-center justify-between">
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
                <div className="mt-4 flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-linear-accent" />
                </div>
              ) : unbilledEntries.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-linear-border-subtle bg-linear-bg-secondary p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-linear-text-tertiary opacity-50" />
                  <p className="mt-2 text-sm text-linear-text-secondary">
                    Nu există pontaje nefacturate
                  </p>
                  <p className="mt-1 text-xs text-linear-text-tertiary">
                    Poți adăuga linii manuale mai jos
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {unbilledEntries.map((entry) => {
                    const isSelected = selectedTimeEntryIds.includes(entry.id);
                    return (
                      <button
                        key={entry.id}
                        onClick={() => handleToggleEntry(entry.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition-colors',
                          isSelected
                            ? 'border-linear-accent bg-linear-accent/5'
                            : 'border-linear-border-subtle hover:border-linear-accent/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              isSelected
                                ? 'border-linear-accent bg-linear-accent'
                                : 'border-linear-border-subtle'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm text-linear-text-primary">
                                {entry.description}
                              </p>
                              <span className="shrink-0 text-sm font-medium text-linear-text-primary">
                                {(entry.hours * entry.rateEur).toFixed(2)} EUR
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-linear-text-tertiary">
                              <span>{entry.date}</span>
                              <span>·</span>
                              <span>
                                {entry.hours}h × {entry.rateEur} EUR
                              </span>
                              {entry.user && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {entry.user.firstName} {entry.user.lastName}
                                  </span>
                                </>
                              )}
                              {entry.case && !caseId && (
                                <>
                                  <span>·</span>
                                  <span className="text-linear-accent">
                                    {entry.case.caseNumber}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
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

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Data emiterii</span>
              <span className="text-linear-text-primary">{issueDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Scadență</span>
              <span className="text-linear-text-primary">{dueDate}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-linear-border-subtle pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Pontaje</span>
              <span className="text-linear-text-primary">
                {selectedCount} ({totalHours.toFixed(1)}h)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-linear-text-tertiary">Subtotal pontaje</span>
              <span className="text-linear-text-primary">{totalTimeAmount.toFixed(2)} EUR</span>
            </div>
            {manualItems.length > 0 && (
              <div className="flex justify-between">
                <span className="text-linear-text-tertiary">Linii manuale</span>
                <span className="text-linear-text-primary">{manualItemsTotal.toFixed(2)} EUR</span>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-linear-border-subtle pt-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-linear-text-primary">Total</span>
              <span className="text-lg font-semibold text-linear-text-primary">
                {totalAmount.toFixed(2)} EUR
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
