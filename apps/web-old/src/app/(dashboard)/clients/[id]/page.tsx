/**
 * Client Detail Page
 * OPS-365: View and edit client information with cases and billing history
 *
 * Features:
 * - Client header with status and actions
 * - Contact information section
 * - Cases list (linked to this client)
 * - Billing history section
 */

'use client';

import * as React from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  Briefcase,
  FileText,
  Plus,
} from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { PageLayout, PageContent } from '@/components/linear/PageLayout';
import { Breadcrumb, type BreadcrumbItem } from '@/components/linear/Breadcrumb';
import { MinimalTable, TitleSubtitleCell, type ColumnDef } from '@/components/linear/MinimalTable';
import { TabBar, type TabOption } from '@/components/linear/TabBar';
import { StatusDot, StatusBadge } from '@/components/linear/StatusDot';
import { FormModal, FormGroup, FormRow, FormDivider } from '@/components/linear/FormModal';
import { ConfirmDialog } from '@/components/linear/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_CLIENT = gql`
  query GetClient($id: ID!) {
    client(id: $id) {
      id
      name
      contactPerson
      email
      phone
      address
      notes
      status
      createdAt
      cases {
        id
        caseNumber
        title
        status
        createdAt
      }
      invoices {
        id
        number
        amount
        status
        dueDate
        createdAt
      }
    }
  }
`;

const UPDATE_CLIENT = gql`
  mutation UpdateClient($id: ID!, $input: UpdateClientInput!) {
    updateClient(id: $id, input: $input) {
      id
      name
      contactPerson
      email
      phone
      address
      notes
      status
    }
  }
`;

const DELETE_CLIENT = gql`
  mutation DeleteClient($id: ID!) {
    deleteClient(id: $id)
  }
`;

// ============================================================================
// Types
// ============================================================================

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  cases: Case[];
  invoices: Invoice[];
}

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: TabOption[] = [
  { value: 'details', label: 'Detalii' },
  { value: 'cases', label: 'Dosare' },
  { value: 'billing', label: 'Facturare' },
];

// ============================================================================
// Invoice Status Config
// ============================================================================

const invoiceStatusConfig = {
  DRAFT: { label: 'Ciornă', variant: 'neutral' as const },
  PENDING: { label: 'În așteptare', variant: 'medium' as const },
  PAID: { label: 'Plătită', variant: 'success' as const },
  OVERDUE: { label: 'Scadentă', variant: 'urgent' as const },
  CANCELLED: { label: 'Anulată', variant: 'low' as const },
};

// ============================================================================
// EditClientModal Component
// ============================================================================

interface EditClientModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function EditClientModal({ client, open, onOpenChange, onSuccess }: EditClientModalProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const [updateClient, { loading }] = useMutation(UPDATE_CLIENT);

  // Populate form when client changes
  useEffect(() => {
    if (client) {
      setName(client.name);
      setContactPerson(client.contactPerson || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setNotes(client.notes || '');
      setStatus(client.status);
    }
  }, [client]);

  const handleSubmit = async () => {
    if (!client || !name.trim()) return;

    try {
      await updateClient({
        variables: {
          id: client.id,
          input: {
            name: name.trim(),
            contactPerson: contactPerson.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
            status,
          },
        },
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editează client"
      submitLabel="Salvează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <FormGroup label="Denumire client *">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="SC Example SRL"
        />
      </FormGroup>

      <FormGroup label="Persoană de contact">
        <Input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="Ion Popescu"
        />
      </FormGroup>

      <FormRow>
        <FormGroup label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@example.ro"
          />
        </FormGroup>
        <FormGroup label="Telefon">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+40 712 345 678"
          />
        </FormGroup>
      </FormRow>

      <FormGroup label="Adresă">
        <Textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Str. Exemplu nr. 1, București"
          rows={2}
        />
      </FormGroup>

      <FormGroup label="Note">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informații adiționale despre client..."
          rows={3}
        />
      </FormGroup>

      <FormDivider />

      <FormGroup label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
          className={cn(
            'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5',
            'text-sm text-linear-text-primary',
            'focus:border-linear-accent focus:outline-none focus:ring-2 focus:ring-linear-accent/20'
          )}
        >
          <option value="ACTIVE">Activ</option>
          <option value="INACTIVE">Inactiv</option>
        </select>
      </FormGroup>
    </FormModal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  // State
  const [activeTab, setActiveTab] = useState('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch client
  const { data, loading, refetch } = useQuery(GET_CLIENT, {
    variables: { id: clientId },
    fetchPolicy: 'cache-and-network',
  });

  // Mutations
  const [deleteClient, { loading: deleteLoading }] = useMutation(DELETE_CLIENT);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: Client | null = (data as any)?.client ?? null;

  // Set document title
  useEffect(() => {
    if (client) {
      document.title = `${client.name} - Clienți`;
    }
  }, [client]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!client) return;

    try {
      await deleteClient({ variables: { id: client.id } });
      router.push('/clients');
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  }, [client, deleteClient, router]);

  // Breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(
    () => [
      { label: 'Clienți', href: '/clients' },
      { label: client?.name || 'Client', current: true },
    ],
    [client]
  );

  // Cases table columns
  const casesColumns: ColumnDef<Case>[] = useMemo(
    () => [
      {
        id: 'case',
        header: 'Dosar',
        accessor: (row) => (
          <TitleSubtitleCell title={row.caseNumber} subtitle={row.title} titleAccent />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: '120px',
        accessor: (row) => (
          <StatusDot
            status={
              row.status === 'ACTIVE' ? 'active' : row.status === 'CLOSED' ? 'neutral' : 'pending'
            }
            size="md"
            label={
              row.status === 'ACTIVE' ? 'Activ' : row.status === 'CLOSED' ? 'Închis' : row.status
            }
          />
        ),
      },
      {
        id: 'date',
        header: 'Creat',
        width: '120px',
        align: 'right',
        accessor: (row) => (
          <span className="text-xs text-linear-text-tertiary">
            {new Date(row.createdAt).toLocaleDateString('ro-RO')}
          </span>
        ),
      },
    ],
    []
  );

  // Invoices table columns
  const invoicesColumns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Factură',
        accessor: (row) => (
          <span className="font-mono text-sm font-medium text-linear-accent">{row.number}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Sumă',
        width: '120px',
        align: 'right',
        accessor: (row) => (
          <span className="font-mono text-sm text-linear-text-primary">
            €{row.amount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
          </span>
        ),
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
      {
        id: 'dueDate',
        header: 'Scadență',
        width: '120px',
        align: 'right',
        accessor: (row) => (
          <span className="text-xs text-linear-text-tertiary">
            {new Date(row.dueDate).toLocaleDateString('ro-RO')}
          </span>
        ),
      },
    ],
    []
  );

  // Loading state
  if (loading && !client) {
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
  if (!client) {
    return (
      <PageLayout>
        <PageContent className="mt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-linear-text-muted" />
            <h3 className="mt-4 text-base font-medium text-linear-text-primary">Client negăsit</h3>
            <p className="mt-1 text-sm text-linear-text-tertiary">
              Clientul solicitat nu există sau a fost șters.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => router.push('/clients')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Înapoi la clienți
            </Button>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Breadcrumb Navigation */}
      <div className="border-b border-linear-border-subtle bg-linear-bg-primary/80 px-6 py-3 backdrop-blur-xl">
        <Breadcrumb items={breadcrumbs} />
      </div>

      <PageContent className="mt-6 space-y-6">
        {/* Client Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-linear-bg-tertiary">
              <Building2 className="h-7 w-7 text-linear-text-tertiary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-linear-text-primary">{client.name}</h1>
                <StatusDot
                  status={client.status === 'ACTIVE' ? 'active' : 'neutral'}
                  size="md"
                  label={client.status === 'ACTIVE' ? 'Activ' : 'Inactiv'}
                />
              </div>
              {client.contactPerson && (
                <p className="mt-1 text-sm text-linear-text-secondary">{client.contactPerson}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Editează
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-linear-error hover:bg-linear-error/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <TabBar tabs={tabs} value={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Info */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">
                Informații contact
              </h2>
              <div className="space-y-4">
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-linear-text-tertiary" />
                    <a
                      href={`mailto:${client.email}`}
                      className="text-sm text-linear-accent hover:underline"
                    >
                      {client.email}
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-linear-text-tertiary" />
                    <a
                      href={`tel:${client.phone}`}
                      className="text-sm text-linear-text-primary hover:underline"
                    >
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-linear-text-tertiary" />
                    <span className="text-sm text-linear-text-primary">{client.address}</span>
                  </div>
                )}
                {!client.email && !client.phone && !client.address && (
                  <p className="text-sm text-linear-text-muted">Nu există informații de contact.</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">Note</h2>
              {client.notes ? (
                <p className="text-sm text-linear-text-primary whitespace-pre-wrap">
                  {client.notes}
                </p>
              ) : (
                <p className="text-sm text-linear-text-muted">
                  Nu există note pentru acest client.
                </p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-linear-text-secondary">Statistici</h2>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-2xl font-semibold text-linear-text-primary">
                    {client.cases.length}
                  </p>
                  <p className="text-xs text-linear-text-tertiary">Dosare totale</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-linear-text-primary">
                    {client.cases.filter((c) => c.status === 'ACTIVE').length}
                  </p>
                  <p className="text-xs text-linear-text-tertiary">Dosare active</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-linear-text-primary">
                    {client.invoices.length}
                  </p>
                  <p className="text-xs text-linear-text-tertiary">Facturi emise</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-linear-success">
                    €
                    {client.invoices
                      .filter((i) => i.status === 'PAID')
                      .reduce((sum, i) => sum + i.amount, 0)
                      .toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-linear-text-tertiary">Încasări totale</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
            <MinimalTable
              columns={casesColumns}
              data={client.cases}
              getRowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/cases/${row.id}`)}
              emptyState={
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-12 w-12 text-linear-text-muted" />
                  <h3 className="mt-4 text-base font-medium text-linear-text-primary">
                    Niciun dosar
                  </h3>
                  <p className="mt-1 text-sm text-linear-text-tertiary">
                    Acest client nu are încă dosare asociate.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-4"
                    onClick={() => router.push('/cases?newCase=true&clientId=' + client.id)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Dosar nou
                  </Button>
                </div>
              }
            />
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
            <MinimalTable
              columns={invoicesColumns}
              data={client.invoices}
              getRowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/facturare/${row.id}`)}
              emptyState={
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-linear-text-muted" />
                  <h3 className="mt-4 text-base font-medium text-linear-text-primary">
                    Nicio factură
                  </h3>
                  <p className="mt-1 text-sm text-linear-text-tertiary">
                    Nu există facturi pentru acest client.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-4"
                    onClick={() => router.push('/facturare?newInvoice=true&clientId=' + client.id)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Factură nouă
                  </Button>
                </div>
              }
            />
          </div>
        )}
      </PageContent>

      {/* Edit Client Modal */}
      <EditClientModal
        client={client}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Șterge client"
        description={`Sigur vrei să ștergi clientul "${client.name}"? Această acțiune nu poate fi anulată.`}
        actionLabel="Șterge"
        severity="danger"
        onAction={handleDelete}
        loading={deleteLoading}
      />
    </PageLayout>
  );
}
