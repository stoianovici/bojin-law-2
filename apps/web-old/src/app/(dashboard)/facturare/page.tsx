/**
 * Billing Page (Facturare)
 * OPS-365: Invoice management with period filter, status toggle, and CRUD operations
 *
 * Features:
 * - Period filter (month selector)
 * - Status toggle (Toate, Neplătite, Plătite, Anulate)
 * - Invoice table with report-style totals
 * - New invoice modal with line items
 * - Click row to view details
 */

'use client';

import * as React from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileText, ChevronLeft, ChevronRight, Calendar, Euro, Trash2 } from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { PageLayout, PageHeader, PageContent } from '@/components/linear/PageLayout';
import {
  MinimalTable,
  TitleSubtitleCell,
  NumericCell,
  type ColumnDef,
} from '@/components/linear/MinimalTable';
import { StatusToggle, type StatusToggleOption } from '@/components/linear/StatusToggle';
import { StatusBadge } from '@/components/linear/StatusDot';
import { FormModal, FormGroup, FormRow, FormDivider } from '@/components/linear/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_INVOICES = gql`
  query GetInvoices($first: Int!, $filters: InvoiceFilters) {
    invoices(first: $first, filters: $filters) {
      edges {
        node {
          id
          number
          client {
            id
            name
          }
          case {
            id
            caseNumber
            title
          }
          amount
          tax
          total
          status
          dueDate
          createdAt
        }
      }
      totalCount
      summary {
        totalAmount
        paidAmount
        pendingAmount
        overdueAmount
      }
    }
  }
`;

const GET_CLIENTS_FOR_INVOICE = gql`
  query GetClientsForInvoice {
    clients(first: 100, filters: { status: ACTIVE }) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_CASES_FOR_INVOICE = gql`
  query GetCasesForInvoice($clientId: ID) {
    cases(first: 100, filters: { clientId: $clientId, status: ACTIVE }) {
      edges {
        node {
          id
          caseNumber
          title
        }
      }
    }
  }
`;

const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: CreateInvoiceInput!) {
    createInvoice(input: $input) {
      id
      number
      amount
      total
      status
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

type InvoiceStatus = 'ALL' | 'UNPAID' | 'PAID' | 'CANCELLED';

interface Invoice {
  id: string;
  number: string;
  client: {
    id: string;
    name: string;
  };
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  } | null;
  amount: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  createdAt: string;
}

interface InvoiceSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusOptions: StatusToggleOption<InvoiceStatus>[] = [
  { value: 'ALL', label: 'Toate' },
  { value: 'UNPAID', label: 'Neplătite' },
  { value: 'PAID', label: 'Plătite' },
  { value: 'CANCELLED', label: 'Anulate' },
];

const invoiceStatusConfig = {
  DRAFT: { label: 'Ciornă', variant: 'neutral' as const },
  PENDING: { label: 'În așteptare', variant: 'medium' as const },
  PAID: { label: 'Plătită', variant: 'success' as const },
  OVERDUE: { label: 'Scadentă', variant: 'urgent' as const },
  CANCELLED: { label: 'Anulată', variant: 'low' as const },
};

// ============================================================================
// Period Picker Component
// ============================================================================

interface PeriodPickerProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

function PeriodPicker({ month, year, onChange }: PeriodPickerProps) {
  const monthName = new Date(year, month).toLocaleDateString('ro-RO', { month: 'long' });

  const goToPrev = () => {
    if (month === 0) {
      onChange(11, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const goToNext = () => {
    if (month === 11) {
      onChange(0, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    onChange(now.getMonth(), now.getFullYear());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return month === now.getMonth() && year === now.getFullYear();
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
        <button
          type="button"
          onClick={goToPrev}
          className="flex h-9 w-9 items-center justify-center text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 px-3">
          <Calendar className="h-4 w-4 text-linear-text-tertiary" />
          <span className="text-sm font-medium capitalize text-linear-text-primary">
            {monthName} {year}
          </span>
        </div>
        <button
          type="button"
          onClick={goToNext}
          className="flex h-9 w-9 items-center justify-center text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isCurrentMonth() && (
        <button
          type="button"
          onClick={goToCurrentMonth}
          className="text-xs font-medium text-linear-text-tertiary transition-colors hover:text-linear-accent"
        >
          Luna curentă
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Summary Stats Component
// ============================================================================

interface SummaryStatsProps {
  summary?: InvoiceSummary | null;
  loading?: boolean;
}

function SummaryStats({ summary, loading }: SummaryStatsProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-6 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-5 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-linear-bg-tertiary" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="flex items-center gap-6 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-5 py-3">
      <div className="flex items-center gap-2">
        <Euro className="h-4 w-4 text-linear-text-tertiary" />
        <span className="text-sm text-linear-text-secondary">Total:</span>
        <span className="font-mono text-sm font-semibold text-linear-text-primary">
          €{summary.totalAmount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="h-4 w-px bg-linear-border-subtle" />
      <div className="flex items-center gap-2">
        <span className="text-sm text-linear-text-secondary">Încasat:</span>
        <span className="font-mono text-sm font-medium text-linear-success">
          €{summary.paidAmount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-linear-text-secondary">În așteptare:</span>
        <span className="font-mono text-sm text-linear-text-tertiary">
          €{summary.pendingAmount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      {summary.overdueAmount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-linear-text-secondary">Scadent:</span>
          <span className="font-mono text-sm text-linear-error">
            €{summary.overdueAmount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Line Item Row Component
// ============================================================================

interface LineItemRowProps {
  item: LineItem;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
  isOnly: boolean;
}

function LineItemRow({ item, onChange, onRemove, isOnly }: LineItemRowProps) {
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...item, description: e.target.value });
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const quantity = parseFloat(e.target.value) || 0;
    onChange({
      ...item,
      quantity,
      total: quantity * item.unitPrice,
    });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const unitPrice = parseFloat(e.target.value) || 0;
    onChange({
      ...item,
      unitPrice,
      total: item.quantity * unitPrice,
    });
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <Input
          value={item.description}
          onChange={handleDescriptionChange}
          placeholder="Descriere serviciu..."
        />
      </div>
      <div className="w-20">
        <Input
          type="number"
          value={item.quantity || ''}
          onChange={handleQuantityChange}
          placeholder="Cant."
          min="0"
          step="1"
          className="text-center"
        />
      </div>
      <div className="w-28">
        <Input
          type="number"
          value={item.unitPrice || ''}
          onChange={handlePriceChange}
          placeholder="Preț"
          min="0"
          step="0.01"
          className="text-right font-mono"
        />
      </div>
      <div className="w-28 flex items-center justify-end pt-2">
        <span className="font-mono text-sm text-linear-text-primary">
          €{item.total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={isOnly}
        className={cn(
          'mt-2 rounded p-1.5 transition-colors',
          isOnly
            ? 'text-linear-text-muted cursor-not-allowed'
            : 'text-linear-text-tertiary hover:bg-linear-error/10 hover:text-linear-error'
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// NewInvoiceModal Component
// ============================================================================

interface NewInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultClientId?: string;
}

function NewInvoiceModal({ open, onOpenChange, onSuccess, defaultClientId }: NewInvoiceModalProps) {
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [caseId, setCaseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const taxRate = 0.19; // 19% TVA

  // Fetch clients
  const { data: clientsData } = useQuery(GET_CLIENTS_FOR_INVOICE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients: ClientOption[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (clientsData as any)?.clients?.edges?.map((e: { node: ClientOption }) => e.node) ?? [];
  }, [clientsData]);

  // Fetch cases for selected client
  const { data: casesData } = useQuery(GET_CASES_FOR_INVOICE, {
    variables: { clientId: clientId || undefined },
    skip: !clientId,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cases: CaseOption[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (casesData as any)?.cases?.edges?.map((e: { node: CaseOption }) => e.node) ?? [];
  }, [casesData]);

  const [createInvoice, { loading }] = useMutation(CREATE_INVOICE);

  // Calculate totals
  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.total, 0), [lineItems]);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // Reset form
  const resetForm = useCallback(() => {
    setClientId(defaultClientId || '');
    setCaseId('');
    setDueDate('');
    setNotes('');
    setLineItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  }, [defaultClientId]);

  // Handle line item changes
  const handleLineItemChange = (index: number, item: LineItem) => {
    const newItems = [...lineItems];
    newItems[index] = item;
    setLineItems(newItems);
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!clientId || lineItems.every((item) => !item.description.trim())) return;

    try {
      await createInvoice({
        variables: {
          input: {
            clientId,
            caseId: caseId || null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            notes: notes.trim() || null,
            lineItems: lineItems
              .filter((item) => item.description.trim())
              .map((item) => ({
                description: item.description.trim(),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
          },
        },
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  // Set default due date (30 days from now)
  useEffect(() => {
    if (open && !dueDate) {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      setDueDate(defaultDue.toISOString().split('T')[0]);
    }
  }, [open, dueDate]);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Factură nouă"
      submitLabel="Creează"
      onSubmit={handleSubmit}
      loading={loading}
      width="lg"
    >
      <FormRow>
        <FormGroup label="Client *">
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setCaseId(''); // Reset case when client changes
            }}
            className={cn(
              'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5',
              'text-sm text-linear-text-primary',
              'focus:border-linear-accent focus:outline-none focus:ring-2 focus:ring-linear-accent/20'
            )}
          >
            <option value="">Selectează client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="Dosar (opțional)">
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            disabled={!clientId}
            className={cn(
              'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5',
              'text-sm text-linear-text-primary',
              'focus:border-linear-accent focus:outline-none focus:ring-2 focus:ring-linear-accent/20',
              !clientId && 'cursor-not-allowed opacity-50'
            )}
          >
            <option value="">Fără dosar asociat</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} - {c.title}
              </option>
            ))}
          </select>
        </FormGroup>
      </FormRow>

      <FormDivider />

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
            Servicii
          </label>
          <div className="flex items-center gap-6 text-[11px] text-linear-text-muted">
            <span className="w-20 text-center">Cant.</span>
            <span className="w-28 text-right">Preț unitar</span>
            <span className="w-28 text-right">Total</span>
            <span className="w-8" />
          </div>
        </div>

        {lineItems.map((item, index) => (
          <LineItemRow
            key={item.id}
            item={item}
            onChange={(updated) => handleLineItemChange(index, updated)}
            onRemove={() => handleRemoveLineItem(index)}
            isOnly={lineItems.length === 1}
          />
        ))}

        <Button
          type="button"
          variant="ghost"
          onClick={handleAddLineItem}
          className="text-linear-accent"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adaugă serviciu
        </Button>
      </div>

      <FormDivider />

      {/* Totals */}
      <div className="space-y-2 text-right">
        <div className="flex items-center justify-end gap-4">
          <span className="text-sm text-linear-text-secondary">Subtotal:</span>
          <span className="w-28 font-mono text-sm text-linear-text-primary">
            €{subtotal.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-end gap-4">
          <span className="text-sm text-linear-text-secondary">TVA (19%):</span>
          <span className="w-28 font-mono text-sm text-linear-text-tertiary">
            €{tax.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-end gap-4 pt-2 border-t border-linear-border-subtle">
          <span className="text-sm font-medium text-linear-text-primary">Total:</span>
          <span className="w-28 font-mono text-base font-semibold text-linear-text-primary">
            €{total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <FormDivider />

      <FormRow>
        <FormGroup label="Scadență">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormGroup>
        <div /> {/* Spacer */}
      </FormRow>

      <FormGroup label="Note">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informații adiționale pentru factură..."
          rows={2}
        />
      </FormGroup>
    </FormModal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set document title
  useEffect(() => {
    document.title = 'Facturare';
  }, []);

  // State
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check for newInvoice query param
  const defaultClientId = searchParams.get('clientId') || undefined;
  useEffect(() => {
    if (searchParams.get('newInvoice') === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Calculate date range for period
  const dateRange = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [month, year]);

  // Convert status filter to API format
  const apiStatusFilter = useMemo(() => {
    switch (statusFilter) {
      case 'UNPAID':
        return ['DRAFT', 'PENDING', 'OVERDUE'];
      case 'PAID':
        return ['PAID'];
      case 'CANCELLED':
        return ['CANCELLED'];
      default:
        return undefined;
    }
  }, [statusFilter]);

  // Fetch invoices
  const { data, loading, refetch } = useQuery(GET_INVOICES, {
    variables: {
      first: 100,
      filters: {
        dateFrom: dateRange.start.toISOString(),
        dateTo: dateRange.end.toISOString(),
        status: apiStatusFilter,
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices: Invoice[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.invoices?.edges?.map((edge: { node: Invoice }) => edge.node) ?? [];
  }, [data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: InvoiceSummary | null = (data as any)?.invoices?.summary ?? null;

  // Handle row click
  const handleRowClick = useCallback(
    (invoice: Invoice) => {
      router.push(`/facturare/${invoice.id}`);
    },
    [router]
  );

  // Handle period change
  const handlePeriodChange = useCallback((newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  }, []);

  // Table columns
  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Factură',
        width: '120px',
        accessor: (row) => (
          <span className="font-mono text-sm font-semibold text-linear-accent">{row.number}</span>
        ),
      },
      {
        id: 'client',
        header: 'Client',
        accessor: (row) => (
          <TitleSubtitleCell
            title={row.client.name}
            subtitle={row.case ? `${row.case.caseNumber} - ${row.case.title}` : undefined}
          />
        ),
      },
      {
        id: 'amount',
        header: 'Sumă',
        width: '120px',
        align: 'right',
        accessor: (row) => <NumericCell value={row.total} unit="€" />,
        cellClassName: 'font-mono',
      },
      {
        id: 'dueDate',
        header: 'Scadență',
        width: '120px',
        accessor: (row) => {
          const dueDate = new Date(row.dueDate);
          const isOverdue =
            row.status !== 'PAID' && row.status !== 'CANCELLED' && dueDate < new Date();
          return (
            <span
              className={cn(
                'text-sm',
                isOverdue ? 'text-linear-error' : 'text-linear-text-tertiary'
              )}
            >
              {dueDate.toLocaleDateString('ro-RO')}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: '120px',
        accessor: (row) => {
          const config = invoiceStatusConfig[row.status];
          return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
        },
      },
    ],
    []
  );

  // Table footer with totals
  const tableFooter = useMemo(() => {
    if (invoices.length === 0) return null;

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);

    return (
      <>
        <td className="px-3 py-3 text-sm font-medium text-linear-text-secondary" colSpan={2}>
          Total ({invoices.length} {invoices.length === 1 ? 'factură' : 'facturi'})
        </td>
        <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-linear-text-primary">
          €{totalAmount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </td>
        <td colSpan={2} />
      </>
    );
  }, [invoices]);

  return (
    <PageLayout>
      {/* Page Header */}
      <PageHeader
        title="Facturare"
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Factură nouă
          </Button>
        }
      />

      <PageContent className="mt-6 space-y-6">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PeriodPicker month={month} year={year} onChange={handlePeriodChange} />
            <StatusToggle options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          </div>
          <SummaryStats summary={summary} loading={loading && !data} />
        </div>

        {/* Invoices Table */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <MinimalTable
            columns={columns}
            data={invoices}
            getRowKey={(row) => row.id}
            onRowClick={handleRowClick}
            loading={loading && !data}
            footer={tableFooter}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-linear-text-muted" />
                <h3 className="mt-4 text-base font-medium text-linear-text-primary">
                  {statusFilter !== 'ALL'
                    ? 'Nicio factură găsită'
                    : 'Nicio factură în această perioadă'}
                </h3>
                <p className="mt-1 text-sm text-linear-text-tertiary">
                  {statusFilter !== 'ALL'
                    ? 'Încearcă să modifici filtrele.'
                    : 'Creează prima factură pentru a începe.'}
                </p>
                {statusFilter === 'ALL' && (
                  <Button variant="primary" className="mt-4" onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Factură nouă
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </PageContent>

      {/* New Invoice Modal */}
      <NewInvoiceModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={() => refetch()}
        defaultClientId={defaultClientId}
      />
    </PageLayout>
  );
}
