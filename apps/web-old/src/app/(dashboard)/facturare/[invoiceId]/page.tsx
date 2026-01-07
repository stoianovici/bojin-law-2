/**
 * Invoice Detail Page
 * OPS-365: View invoice details with actions (mark paid, send, download)
 *
 * Features:
 * - Invoice header with number, date, status
 * - Client info section
 * - Line items table
 * - Totals section
 * - Actions: Mark paid, Send, Download PDF
 */

'use client';

import * as React from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  CheckCircle,
  Send,
  Download,
  Trash2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { PageLayout, PageContent } from '@/components/linear/PageLayout';
import { Breadcrumb, type BreadcrumbItem } from '@/components/linear/Breadcrumb';
import { StatusBadge } from '@/components/linear/StatusDot';
import { ConfirmDialog } from '@/components/linear/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_INVOICE = gql`
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id
      number
      client {
        id
        name
        email
        address
      }
      case {
        id
        caseNumber
        title
      }
      lineItems {
        id
        description
        quantity
        unitPrice
        total
      }
      amount
      tax
      total
      status
      dueDate
      paidDate
      notes
      createdAt
    }
  }
`;

const UPDATE_INVOICE_STATUS = gql`
  mutation UpdateInvoiceStatus($id: ID!, $status: InvoiceStatus!) {
    updateInvoiceStatus(id: $id, status: $status) {
      id
      status
      paidDate
    }
  }
`;

const DELETE_INVOICE = gql`
  mutation DeleteInvoice($id: ID!) {
    deleteInvoice(id: $id)
  }
`;

const SEND_INVOICE = gql`
  mutation SendInvoice($id: ID!) {
    sendInvoice(id: $id) {
      id
      status
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  number: string;
  client: {
    id: string;
    name: string;
    email?: string | null;
    address?: string | null;
  };
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  } | null;
  lineItems: LineItem[];
  amount: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  paidDate?: string | null;
  notes?: string | null;
  createdAt: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

const invoiceStatusConfig = {
  DRAFT: {
    label: 'Ciornă',
    variant: 'neutral' as const,
    icon: FileText,
    color: 'text-linear-text-tertiary',
  },
  PENDING: {
    label: 'În așteptare',
    variant: 'medium' as const,
    icon: Calendar,
    color: 'text-[#3B82F6]',
  },
  PAID: {
    label: 'Plătită',
    variant: 'success' as const,
    icon: CheckCircle,
    color: 'text-linear-success',
  },
  OVERDUE: {
    label: 'Scadentă',
    variant: 'urgent' as const,
    icon: AlertCircle,
    color: 'text-linear-error',
  },
  CANCELLED: {
    label: 'Anulată',
    variant: 'low' as const,
    icon: XCircle,
    color: 'text-linear-text-muted',
  },
};

// ============================================================================
// Line Items Table Component
// ============================================================================

interface LineItemsTableProps {
  items: LineItem[];
}

function LineItemsTable({ items }: LineItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-linear-border-subtle">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-linear-bg-tertiary">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
              Descriere
            </th>
            <th className="w-24 px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
              Cant.
            </th>
            <th className="w-32 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
              Preț unitar
            </th>
            <th className="w-32 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-linear-border-subtle">
              <td className="px-4 py-3 text-sm text-linear-text-primary">{item.description}</td>
              <td className="px-4 py-3 text-center font-mono text-sm text-linear-text-secondary">
                {item.quantity}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-linear-text-secondary">
                €{item.unitPrice.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm font-medium text-linear-text-primary">
                €{item.total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Totals Section Component
// ============================================================================

interface TotalsSectionProps {
  amount: number;
  tax: number;
  total: number;
}

function TotalsSection({ amount, tax, total }: TotalsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-linear-text-secondary">Subtotal</span>
        <span className="font-mono text-sm text-linear-text-primary">
          €{amount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-linear-text-secondary">TVA (19%)</span>
        <span className="font-mono text-sm text-linear-text-tertiary">
          €{tax.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-linear-border-subtle pt-2">
        <span className="text-base font-medium text-linear-text-primary">Total</span>
        <span className="font-mono text-lg font-semibold text-linear-text-primary">
          €{total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  // State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

  // Fetch invoice
  const { data, loading, refetch } = useQuery(GET_INVOICE, {
    variables: { id: invoiceId },
    fetchPolicy: 'cache-and-network',
  });

  // Mutations
  const [updateStatus, { loading: updateLoading }] = useMutation(UPDATE_INVOICE_STATUS);
  const [deleteInvoice, { loading: deleteLoading }] = useMutation(DELETE_INVOICE);
  const [sendInvoice, { loading: sendLoading }] = useMutation(SEND_INVOICE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice: Invoice | null = (data as any)?.invoice ?? null;

  // Set document title
  useEffect(() => {
    if (invoice) {
      document.title = `Factură ${invoice.number}`;
    }
  }, [invoice]);

  // Handle mark as paid
  const handleMarkPaid = useCallback(async () => {
    if (!invoice) return;

    try {
      await updateStatus({
        variables: { id: invoice.id, status: 'PAID' },
      });
      setIsMarkPaidDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
    }
  }, [invoice, updateStatus, refetch]);

  // Handle cancel invoice
  const handleCancel = useCallback(async () => {
    if (!invoice) return;

    try {
      await updateStatus({
        variables: { id: invoice.id, status: 'CANCELLED' },
      });
      setIsCancelDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
    }
  }, [invoice, updateStatus, refetch]);

  // Handle send invoice
  const handleSend = useCallback(async () => {
    if (!invoice) return;

    try {
      await sendInvoice({
        variables: { id: invoice.id },
      });
      setIsSendDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Failed to send invoice:', error);
    }
  }, [invoice, sendInvoice, refetch]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!invoice) return;

    try {
      await deleteInvoice({ variables: { id: invoice.id } });
      router.push('/facturare');
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  }, [invoice, deleteInvoice, router]);

  // Handle download PDF
  const handleDownload = useCallback(() => {
    if (!invoice) return;
    // In a real implementation, this would call an API to generate and download the PDF
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
  }, [invoice]);

  // Breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(
    () => [
      { label: 'Facturare', href: '/facturare' },
      { label: invoice?.number || 'Factură', current: true },
    ],
    [invoice]
  );

  // Status config
  const statusConfig = invoice ? invoiceStatusConfig[invoice.status] : null;
  const StatusIcon = statusConfig?.icon || FileText;

  // Loading state
  if (loading && !invoice) {
    return (
      <PageLayout>
        <PageContent className="mt-6">
          <div className="flex items-center gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-linear-bg-tertiary" />
          </div>
          <div className="mt-8 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-6">
            <div className="h-8 w-48 animate-pulse rounded bg-linear-bg-tertiary" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-linear-bg-tertiary" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  // Not found state
  if (!invoice) {
    return (
      <PageLayout>
        <PageContent className="mt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-linear-text-muted" />
            <h3 className="mt-4 text-base font-medium text-linear-text-primary">
              Factură negăsită
            </h3>
            <p className="mt-1 text-sm text-linear-text-tertiary">
              Factura solicitată nu există sau a fost ștearsă.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => router.push('/facturare')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Înapoi la facturi
            </Button>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const canMarkPaid = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';
  const canSend = invoice.status === 'DRAFT';
  const canCancel = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
  const canDelete = invoice.status === 'DRAFT';

  return (
    <PageLayout>
      {/* Breadcrumb Navigation */}
      <div className="border-b border-linear-border-subtle bg-linear-bg-primary/80 px-6 py-3 backdrop-blur-xl">
        <Breadcrumb items={breadcrumbs} />
      </div>

      <PageContent className="mt-6 space-y-6">
        {/* Invoice Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-xl',
                invoice.status === 'PAID'
                  ? 'bg-linear-success/10'
                  : invoice.status === 'OVERDUE'
                    ? 'bg-linear-error/10'
                    : 'bg-linear-bg-tertiary'
              )}
            >
              <StatusIcon className={cn('h-7 w-7', statusConfig?.color)} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-xl font-semibold text-linear-accent">
                  {invoice.number}
                </h1>
                <StatusBadge variant={statusConfig?.variant}>{statusConfig?.label}</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-linear-text-secondary">
                Emis pe{' '}
                {new Date(invoice.createdAt).toLocaleDateString('ro-RO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canSend && (
              <Button variant="secondary" onClick={() => setIsSendDialogOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                Trimite
              </Button>
            )}
            {canMarkPaid && (
              <Button variant="primary" onClick={() => setIsMarkPaidDialogOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Marchează plătită
              </Button>
            )}
            <Button variant="secondary" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            {canCancel && (
              <Button
                variant="ghost"
                onClick={() => setIsCancelDialogOpen(true)}
                className="text-linear-warning hover:bg-linear-warning/10"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-linear-error hover:bg-linear-error/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Line Items */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">
                Servicii facturate
              </h2>
              <LineItemsTable items={invoice.lineItems} />
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
                <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">Note</h2>
                <p className="text-sm text-linear-text-primary whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">Client</h2>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-bg-tertiary">
                  <Building2 className="h-5 w-5 text-linear-text-tertiary" />
                </div>
                <div>
                  <button
                    onClick={() => router.push(`/clients/${invoice.client.id}`)}
                    className="text-sm font-medium text-linear-accent hover:underline"
                  >
                    {invoice.client.name}
                  </button>
                  {invoice.client.email && (
                    <p className="mt-0.5 text-xs text-linear-text-tertiary">
                      {invoice.client.email}
                    </p>
                  )}
                  {invoice.client.address && (
                    <p className="mt-1 text-xs text-linear-text-tertiary">
                      {invoice.client.address}
                    </p>
                  )}
                </div>
              </div>

              {invoice.case && (
                <div className="mt-4 border-t border-linear-border-subtle pt-4">
                  <p className="text-xs text-linear-text-tertiary">Dosar asociat</p>
                  <button
                    onClick={() => router.push(`/cases/${invoice.case!.id}`)}
                    className="mt-1 text-sm text-linear-accent hover:underline"
                  >
                    <span className="font-mono">{invoice.case.caseNumber}</span>
                    <span className="ml-1 text-linear-text-secondary">- {invoice.case.title}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">
                Date importante
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-linear-text-tertiary">Emisă</span>
                  <span className="text-sm text-linear-text-primary">
                    {new Date(invoice.createdAt).toLocaleDateString('ro-RO')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-linear-text-tertiary">Scadență</span>
                  <span
                    className={cn(
                      'text-sm',
                      invoice.status !== 'PAID' &&
                        invoice.status !== 'CANCELLED' &&
                        new Date(invoice.dueDate) < new Date()
                        ? 'text-linear-error'
                        : 'text-linear-text-primary'
                    )}
                  >
                    {new Date(invoice.dueDate).toLocaleDateString('ro-RO')}
                  </span>
                </div>
                {invoice.paidDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-linear-text-tertiary">Plătită</span>
                    <span className="text-sm text-linear-success">
                      {new Date(invoice.paidDate).toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">Sumar</h2>
              <TotalsSection amount={invoice.amount} tax={invoice.tax} total={invoice.total} />
            </div>
          </div>
        </div>
      </PageContent>

      {/* Mark as Paid Dialog */}
      <ConfirmDialog
        open={isMarkPaidDialogOpen}
        onOpenChange={setIsMarkPaidDialogOpen}
        title="Marchează ca plătită"
        description={`Confirmi că factura ${invoice.number} a fost plătită?`}
        actionLabel="Confirmă plata"
        severity="info"
        onAction={handleMarkPaid}
        loading={updateLoading}
      />

      {/* Send Invoice Dialog */}
      <ConfirmDialog
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        title="Trimite factura"
        description={`Factura ${invoice.number} va fi trimisă către ${invoice.client.email || invoice.client.name}. Statusul va fi actualizat la "În așteptare".`}
        actionLabel="Trimite"
        severity="info"
        onAction={handleSend}
        loading={sendLoading}
      />

      {/* Cancel Invoice Dialog */}
      <ConfirmDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        title="Anulează factura"
        description={`Sigur vrei să anulezi factura ${invoice.number}? Această acțiune nu poate fi anulată.`}
        actionLabel="Anulează factura"
        severity="danger"
        onAction={handleCancel}
        loading={updateLoading}
      />

      {/* Delete Invoice Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Șterge factura"
        description={`Sigur vrei să ștergi factura ${invoice.number}? Această acțiune nu poate fi anulată.`}
        actionLabel="Șterge"
        severity="danger"
        onAction={handleDelete}
        loading={deleteLoading}
      />
    </PageLayout>
  );
}
