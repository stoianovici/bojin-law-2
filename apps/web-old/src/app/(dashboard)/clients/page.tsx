/**
 * Clients Page
 * OPS-365: Clients list with search, status filter, and CRUD operations
 *
 * Features:
 * - Search box for client name/contact
 * - Status filter (Activ, Inactiv, Toate)
 * - Minimal table with client info
 * - New client modal
 * - Click row to view details
 */

'use client';

import * as React from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, User, Mail, Phone } from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { PageLayout, PageHeader, PageContent } from '@/components/linear/PageLayout';
import { MinimalTable, TitleSubtitleCell, type ColumnDef } from '@/components/linear/MinimalTable';
import { StatusToggle, type StatusToggleOption } from '@/components/linear/StatusToggle';
import { SearchBox } from '@/components/linear/SearchBox';
import { StatusDot } from '@/components/linear/StatusDot';
import { FormModal, FormGroup, FormRow } from '@/components/linear/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_CLIENTS = gql`
  query GetClients($first: Int!, $filters: ClientFilters) {
    clients(first: $first, filters: $filters) {
      edges {
        node {
          id
          name
          contactPerson
          email
          phone
          status
          casesCount
          createdAt
        }
      }
      totalCount
    }
  }
`;

const CREATE_CLIENT = gql`
  mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      id
      name
      contactPerson
      email
      phone
      status
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

interface Client {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  casesCount: number;
  createdAt: string;
}

// ============================================================================
// Status Filter Options
// ============================================================================

const statusOptions: StatusToggleOption<ClientStatus>[] = [
  { value: 'ALL', label: 'Toate' },
  { value: 'ACTIVE', label: 'Activ' },
  { value: 'INACTIVE', label: 'Inactiv' },
];

// ============================================================================
// NewClientModal Component
// ============================================================================

interface NewClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function NewClientModal({ open, onOpenChange, onSuccess }: NewClientModalProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [createClient, { loading }] = useMutation(CREATE_CLIENT);

  const resetForm = useCallback(() => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      await createClient({
        variables: {
          input: {
            name: name.trim(),
            contactPerson: contactPerson.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
          },
        },
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Client nou"
      submitLabel="Creează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <FormGroup label="Denumire client *">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="SC Example SRL"
          autoFocus
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
    </FormModal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ClientsPage() {
  const router = useRouter();

  // Set document title
  useEffect(() => {
    document.title = 'Clienți';
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch clients
  const { data, loading, refetch } = useQuery(GET_CLIENTS, {
    variables: {
      first: 100,
      filters: {
        search: searchQuery || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients: Client[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.clients?.edges?.map((edge: { node: Client }) => edge.node) ?? [];
  }, [data]);

  // Handle row click
  const handleRowClick = useCallback(
    (client: Client) => {
      router.push(`/clients/${client.id}`);
    },
    [router]
  );

  // Table columns
  const columns: ColumnDef<Client>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Client',
        accessor: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-bg-tertiary">
              <Building2 className="h-4 w-4 text-linear-text-tertiary" />
            </div>
            <TitleSubtitleCell title={row.name} subtitle={row.contactPerson || undefined} />
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        accessor: (row) => (
          <div className="flex flex-col gap-1">
            {row.email && (
              <div className="flex items-center gap-1.5 text-xs text-linear-text-secondary">
                <Mail className="h-3 w-3 text-linear-text-tertiary" />
                {row.email}
              </div>
            )}
            {row.phone && (
              <div className="flex items-center gap-1.5 text-xs text-linear-text-tertiary">
                <Phone className="h-3 w-3" />
                {row.phone}
              </div>
            )}
            {!row.email && !row.phone && <span className="text-xs text-linear-text-muted">—</span>}
          </div>
        ),
      },
      {
        id: 'cases',
        header: 'Dosare',
        width: '100px',
        align: 'center',
        accessor: (row) => (
          <span
            className={cn(
              'font-mono text-sm',
              row.casesCount > 0 ? 'text-linear-text-primary' : 'text-linear-text-muted'
            )}
          >
            {row.casesCount}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: '100px',
        align: 'center',
        accessor: (row) => (
          <StatusDot
            status={row.status === 'ACTIVE' ? 'active' : 'neutral'}
            size="md"
            label={row.status === 'ACTIVE' ? 'Activ' : 'Inactiv'}
          />
        ),
      },
    ],
    []
  );

  return (
    <PageLayout>
      {/* Page Header */}
      <PageHeader
        title="Clienți"
        actions={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Client nou
          </Button>
        }
      />

      <PageContent className="mt-6 space-y-6">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SearchBox
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută client..."
              containerClassName="w-[240px]"
            />
            <StatusToggle options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          </div>
        </div>

        {/* Clients Table */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <MinimalTable
            columns={columns}
            data={clients}
            getRowKey={(row) => row.id}
            onRowClick={handleRowClick}
            loading={loading && !data}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-linear-text-muted" />
                <h3 className="mt-4 text-base font-medium text-linear-text-primary">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Niciun client găsit'
                    : 'Niciun client încă'}
                </h3>
                <p className="mt-1 text-sm text-linear-text-tertiary">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Încearcă să modifici filtrele de căutare.'
                    : 'Adaugă primul client pentru a începe.'}
                </p>
                {!searchQuery && statusFilter === 'ALL' && (
                  <Button variant="primary" className="mt-4" onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Client nou
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </PageContent>

      {/* New Client Modal */}
      <NewClientModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={() => refetch()}
      />
    </PageLayout>
  );
}
