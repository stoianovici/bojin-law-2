/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql, type FetchResult } from '@apollo/client';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  UserCircle,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Briefcase,
  ExternalLink,
  Save,
  Building2,
  Plus,
  Trash2,
  User,
  X,
  FolderOpen,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { cn } from '@/lib/utils';
import { DeleteClientDialog } from './DeleteClientDialog';
import { toast } from '@/components/ui/toast';
import { CREATE_CLIENT } from '@/graphql/mutations';
import { useClientMapas } from '@/hooks/useMapa';
import { CreateMapaModal } from '@/components/documents/CreateMapaModal';
import { MapaCompletionRing } from '@/components/documents/MapaCompletionRing';

// ============================================================================
// GraphQL
// ============================================================================

const GET_CLIENT = gql`
  query GetClient($id: UUID!) {
    client(id: $id) {
      id
      name
      email
      phone
      address
      clientType
      companyType
      cui
      registrationNumber
      administrators {
        id
        name
        role
        email
        phone
      }
      contacts {
        id
        name
        role
        email
        phone
      }
      cases {
        id
        caseNumber
        title
        status
        referenceNumbers
      }
      caseCount
    }
  }
`;

const UPDATE_CLIENT = gql`
  mutation UpdateClient($id: UUID!, $input: UpdateClientInput!) {
    updateClient(id: $id, input: $input) {
      id
      name
      email
      phone
      address
      clientType
      companyType
      cui
      registrationNumber
      administrators {
        id
        name
        role
        email
        phone
      }
      contacts {
        id
        name
        role
        email
        phone
      }
      caseCount
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface ClientPerson {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface ClientData {
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    clientType?: string;
    companyType?: string;
    cui?: string;
    registrationNumber?: string;
    administrators: ClientPerson[];
    contacts: ClientPerson[];
    cases: {
      id: string;
      caseNumber: string;
      title: string;
      status: string;
      referenceNumbers?: string[];
    }[];
    caseCount: number;
  };
}

interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  administrators?: { id?: string; name: string; role: string; email?: string; phone?: string }[];
  contacts?: { id?: string; name: string; role: string; email?: string; phone?: string }[];
}

interface CreateClientResponse {
  createClient: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    caseCount: number;
    activeCaseCount: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const COMPANY_TYPES = [
  { value: 'SRL', label: 'SRL' },
  { value: 'SA', label: 'SA' },
  { value: 'PFA', label: 'PFA' },
  { value: 'II', label: 'II (Întreprindere Individuală)' },
  { value: 'IF', label: 'IF (Întreprindere Familială)' },
  { value: 'ONG', label: 'ONG / Asociație' },
  { value: 'Other', label: 'Altul' },
];

// ============================================================================
// Components
// ============================================================================

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function FormSection({ title, icon, children, className }: FormSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-linear-border-subtle bg-linear-bg-secondary p-6',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-linear-accent/10 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-linear-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-linear-text-secondary">
      {children}
      {required && <span className="text-linear-error ml-0.5">*</span>}
    </label>
  );
}

interface PersonListProps {
  title: string;
  persons: ClientPerson[];
  onChange: (persons: ClientPerson[]) => void;
}

function PersonList({ title, persons, onChange }: PersonListProps) {
  const addPerson = () => {
    onChange([
      ...persons,
      {
        id: crypto.randomUUID(),
        name: '',
        role: '',
        email: '',
        phone: '',
      },
    ]);
  };

  const updatePerson = (index: number, field: keyof ClientPerson, value: string) => {
    const updated = [...persons];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removePerson = (index: number) => {
    onChange(persons.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-linear-text-secondary">{title}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={addPerson}
          leftIcon={<Plus className="w-3 h-3" />}
        >
          Adaugă
        </Button>
      </div>
      {persons.length === 0 ? (
        <p className="text-xs text-linear-text-muted py-2">Nicio persoană adăugată</p>
      ) : (
        <div className="space-y-3">
          {persons.map((person, index) => (
            <div
              key={person.id}
              className="p-3 rounded-lg bg-linear-bg-tertiary border border-linear-border-subtle space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    size="sm"
                    value={person.name}
                    onChange={(e) => updatePerson(index, 'name', e.target.value)}
                    placeholder="Nume complet"
                  />
                  <Input
                    size="sm"
                    value={person.role}
                    onChange={(e) => updatePerson(index, 'role', e.target.value)}
                    placeholder="Funcție / Rol"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePerson(index)}
                  className="text-linear-error hover:bg-linear-error/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  size="sm"
                  type="email"
                  value={person.email || ''}
                  onChange={(e) => updatePerson(index, 'email', e.target.value)}
                  placeholder="Email"
                />
                <Input
                  size="sm"
                  type="tel"
                  value={person.phone || ''}
                  onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                  placeholder="Telefon"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ClientDetailPanelProps {
  clientId: string | null;
  isCreating?: boolean;
  onClientUpdated?: () => void;
  onClientDeleted?: () => void;
  onClientCreated?: (clientId: string) => void;
  onCancelCreate?: () => void;
}

export function ClientDetailPanel({
  clientId,
  isCreating = false,
  onClientUpdated,
  onClientDeleted,
  onClientCreated,
  onCancelCreate,
}: ClientDetailPanelProps) {
  // Fetch client data (skip when creating)
  const {
    data: clientData,
    loading: clientLoading,
    error: clientError,
  } = useQuery<ClientData>(GET_CLIENT, {
    variables: { id: clientId },
    skip: !clientId || isCreating,
    fetchPolicy: 'cache-and-network',
  });

  // Update mutation
  const [updateClient, { loading: updating }] = useMutation(UPDATE_CLIENT);

  // Create mutation
  const [createClient, { loading: creating }] = useMutation<CreateClientResponse>(CREATE_CLIENT);

  // Form state - Basic info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Form state - Company details
  const [clientType, setClientType] = useState<'individual' | 'company'>('company');
  const [companyType, setCompanyType] = useState('');
  const [cui, setCui] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [administrators, setAdministrators] = useState<ClientPerson[]>([]);
  const [contacts, setContacts] = useState<ClientPerson[]>([]);

  // UI state
  const [isInitialized, setIsInitialized] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateMapaModal, setShowCreateMapaModal] = useState(false);

  // Fetch client mape (only when editing, not creating)
  const {
    mapas: clientMape,
    loading: mapeLoading,
    refetch: refetchMape,
  } = useClientMapas(!isCreating ? (clientId ?? undefined) : undefined);

  // Reset form when clientId changes or entering create mode
  useEffect(() => {
    if (isCreating) {
      // Reset form for new client
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setClientType('company');
      setCompanyType('');
      setCui('');
      setRegistrationNumber('');
      setAdministrators([]);
      setContacts([]);
      setIsInitialized(true);
      setShowErrors(false);
      setSaveSuccess(false);
    } else {
      setIsInitialized(false);
      setShowErrors(false);
      setSaveSuccess(false);
    }
  }, [clientId, isCreating]);

  // Initialize form with client data
  useEffect(() => {
    if (clientData?.client && !isInitialized) {
      const client = clientData.client;
      setName(client.name || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setClientType((client.clientType as 'individual' | 'company') || 'company');
      setCompanyType(client.companyType || '');
      setCui(client.cui || '');
      setRegistrationNumber(client.registrationNumber || '');
      setAdministrators(client.administrators || []);
      setContacts(client.contacts || []);
      setIsInitialized(true);
    }
  }, [clientData, isInitialized]);

  // Helper to strip __typename from objects (Apollo cache adds this)
  const stripTypename = (obj: ClientPerson): Omit<ClientPerson, '__typename'> => {
    const { __typename, ...rest } = obj as ClientPerson & { __typename?: string };
    return rest;
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    setSaveSuccess(false);

    if (!name.trim() || !clientId) {
      return;
    }

    try {
      await updateClient({
        variables: {
          id: clientId,
          input: {
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            clientType,
            companyType: clientType === 'company' ? companyType || null : null,
            cui: clientType === 'company' ? cui.trim() || null : null,
            registrationNumber: clientType === 'company' ? registrationNumber.trim() || null : null,
            administrators: administrators.filter((a) => a.name.trim()).map(stripTypename),
            contacts: contacts.filter((c) => c.name.trim()).map(stripTypename),
          },
        },
      });

      setSaveSuccess(true);
      onClientUpdated?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update client:', err);
      toast({
        title: 'Eroare la salvare',
        description: 'A apărut o eroare la salvarea clientului.',
        variant: 'error',
      });
    }
  };

  const handleCreate = async () => {
    setShowErrors(true);

    if (!name.trim()) {
      return;
    }

    try {
      const input: CreateClientInput = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        clientType,
        companyType: clientType === 'company' ? companyType || undefined : undefined,
        cui: clientType === 'company' ? cui.trim() || undefined : undefined,
        registrationNumber:
          clientType === 'company' ? registrationNumber.trim() || undefined : undefined,
        administrators:
          clientType === 'company' && administrators.length > 0
            ? administrators
                .filter((a) => a.name.trim())
                .map((a) => ({
                  name: a.name,
                  role: a.role,
                  email: a.email || undefined,
                  phone: a.phone || undefined,
                }))
            : undefined,
        contacts:
          contacts.length > 0
            ? contacts
                .filter((c) => c.name.trim())
                .map((c) => ({
                  name: c.name,
                  role: c.role,
                  email: c.email || undefined,
                  phone: c.phone || undefined,
                }))
            : undefined,
      };

      const result = (await createClient({
        variables: { input },
        refetchQueries: ['GetClients'],
      })) as FetchResult<CreateClientResponse>;

      if (result.errors && result.errors.length > 0) {
        console.error('[ClientDetailPanel] GraphQL errors:', result.errors);
        toast({
          title: 'Eroare la creare',
          description: result.errors[0].message,
          variant: 'error',
        });
        return;
      }

      if (!result.data?.createClient) {
        toast({
          title: 'Eroare la creare',
          description: 'Nu s-a putut crea clientul. Încercați din nou.',
          variant: 'error',
        });
        return;
      }

      toast({
        title: 'Client creat',
        description: `Clientul "${result.data.createClient.name}" a fost creat cu succes.`,
        variant: 'success',
      });

      onClientCreated?.(result.data.createClient.id);
    } catch (err) {
      console.error('[ClientDetailPanel] Failed to create client:', err);
      toast({
        title: 'Eroare la creare',
        description: err instanceof Error ? err.message : 'Nu s-a putut crea clientul.',
        variant: 'error',
      });
    }
  };

  // Empty state - no client selected (but not creating)
  if (!clientId && !isCreating) {
    return (
      <div className="flex-1 flex items-center justify-center text-linear-text-tertiary bg-linear-bg-primary">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Selectează un client din listă</p>
        </div>
      </div>
    );
  }

  // Loading state (only when editing, not creating)
  if (!isCreating && clientLoading && !clientData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-linear-bg-primary">
        <Loader2 className="w-8 h-8 text-linear-accent animate-spin" />
      </div>
    );
  }

  // Error state (only when editing, not creating)
  if (!isCreating && (clientError || !clientData?.client)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-linear-bg-primary">
        <div className="text-center max-w-md">
          <p className="text-linear-error mb-4">
            {clientError?.message || 'Clientul nu a fost găsit'}
          </p>
        </div>
      </div>
    );
  }

  const client = isCreating ? null : clientData?.client;

  return (
    <div className="flex-1 flex flex-col bg-linear-bg-primary overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-linear-border-subtle flex-shrink-0 bg-linear-bg-primary/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          {isCreating ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-linear-accent/10 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-linear-accent" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-linear-text-primary">Client nou</h1>
                  <p className="text-xs text-linear-text-tertiary">
                    Completează detaliile pentru a crea un client nou
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="md" onClick={onCancelCreate} disabled={creating}>
                  <X className="w-4 h-4 mr-1.5" />
                  Anulează
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreate}
                  disabled={creating}
                  leftIcon={
                    creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )
                  }
                >
                  {creating ? 'Se creează...' : 'Creează client'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-semibold text-linear-text-primary">{client?.name}</h1>
                <p className="text-xs text-linear-text-tertiary">
                  {client?.caseCount} {client?.caseCount === 1 ? 'dosar' : 'dosare'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saveSuccess && <span className="text-xs text-green-500">Salvat cu succes!</span>}
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-linear-error hover:bg-linear-error/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmit}
                  disabled={updating}
                  leftIcon={
                    updating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                >
                  {updating ? 'Se salvează...' : 'Salvează'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full">
        <div className="px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Basic Info */}
              <FormSection
                title="Informații de bază"
                icon={<UserCircle className="w-4 h-4 text-linear-accent" />}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <FieldLabel required>Nume client</FieldLabel>
                    <Input
                      size="lg"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ex: SC Exemplu SRL sau Ion Popescu"
                      error={showErrors && !name.trim()}
                      errorMessage={
                        showErrors && !name.trim() ? 'Numele este obligatoriu' : undefined
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FieldLabel>Email</FieldLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-tertiary" />
                        <Input
                          size="lg"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contact@exemplu.ro"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Telefon</FieldLabel>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-tertiary" />
                        <Input
                          size="lg"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+40 700 000 000"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel>Adresă</FieldLabel>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-linear-text-tertiary" />
                      <Input
                        size="lg"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Str. Exemplu nr. 1, București"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </FormSection>

              {/* Company Details */}
              <FormSection
                title="Detalii companie"
                icon={<Building2 className="w-4 h-4 text-linear-accent" />}
              >
                <div className="space-y-4">
                  {/* Client Type Toggle */}
                  <div className="space-y-2">
                    <FieldLabel>Tip client</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setClientType('company')}
                        className={cn(
                          'px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2',
                          clientType === 'company'
                            ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                            : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover'
                        )}
                      >
                        <Building2 className="w-4 h-4" />
                        Companie
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientType('individual')}
                        className={cn(
                          'px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2',
                          clientType === 'individual'
                            ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                            : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover'
                        )}
                      >
                        <User className="w-4 h-4" />
                        Persoană fizică
                      </button>
                    </div>
                  </div>

                  {clientType === 'company' && (
                    <>
                      {/* Company Type */}
                      <div className="space-y-2">
                        <FieldLabel>Tip companie</FieldLabel>
                        <select
                          value={companyType}
                          onChange={(e) => setCompanyType(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-sm text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent/50"
                        >
                          <option value="">Selectează tipul</option>
                          {COMPANY_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* CUI and Registration Number */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <FieldLabel>CUI / Cod Fiscal</FieldLabel>
                          <Input
                            size="lg"
                            value={cui}
                            onChange={(e) => setCui(e.target.value)}
                            placeholder="ex: RO12345678"
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Nr. Registru Comerț</FieldLabel>
                          <Input
                            size="lg"
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                            placeholder="ex: J40/123/2020"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </FormSection>

              {/* Associated Cases - only show when editing */}
              {!isCreating && client && (
                <FormSection
                  title="Dosare asociate"
                  icon={<Briefcase className="w-4 h-4 text-linear-accent" />}
                >
                  {client.cases.length > 0 ? (
                    <div className="space-y-2">
                      {client.cases.map((caseItem) => (
                        <Link
                          key={caseItem.id}
                          href={`/cases/${caseItem.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-linear-bg-tertiary hover:bg-linear-bg-hover transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-linear-text-primary truncate">
                              {caseItem.title}
                            </p>
                            {caseItem.referenceNumbers?.[0] && (
                              <p className="text-xs text-linear-text-tertiary">
                                {caseItem.referenceNumbers[0]}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-xs px-2 py-1 rounded',
                                caseItem.status === 'Active'
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-linear-bg-hover text-linear-text-secondary'
                              )}
                            >
                              {caseItem.status}
                            </span>
                            <ExternalLink className="w-4 h-4 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-linear-text-muted py-2">Nu există dosare asociate</p>
                  )}
                </FormSection>
              )}

              {/* Mape - only show when editing */}
              {!isCreating && client && (
                <FormSection
                  title="Mape documente"
                  icon={<FolderOpen className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-3">
                    {/* Add mapa button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowCreateMapaModal(true)}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      className="w-full"
                    >
                      Adaugă mapă
                    </Button>

                    {/* Mape list */}
                    {mapeLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-linear-accent animate-spin" />
                      </div>
                    ) : clientMape.length > 0 ? (
                      <div className="space-y-2">
                        {clientMape.map((mapa) => (
                          <Link
                            key={mapa.id}
                            href={`/documents?mapa=${mapa.id}`}
                            className="flex items-center justify-between p-3 rounded-lg bg-linear-bg-tertiary hover:bg-linear-bg-hover transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                <MapaCompletionRing completion={mapa.completionStatus} size="sm" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-linear-text-primary truncate">
                                  {mapa.name}
                                </p>
                                <p className="text-xs text-linear-text-tertiary">
                                  {mapa.completionStatus.filledSlots}/
                                  {mapa.completionStatus.totalSlots} documente
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-linear-text-muted py-2">
                        Nu există mape pentru acest client
                      </p>
                    )}
                  </div>
                </FormSection>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Administrators */}
              {clientType === 'company' && (
                <FormSection
                  title="Administratori"
                  icon={<UserCircle className="w-4 h-4 text-linear-accent" />}
                >
                  <PersonList
                    title="Persoane cu funcții de conducere"
                    persons={administrators}
                    onChange={setAdministrators}
                  />
                </FormSection>
              )}

              {/* Contacts */}
              <FormSection
                title="Persoane de contact"
                icon={<User className="w-4 h-4 text-linear-accent" />}
              >
                <PersonList
                  title="Contacte pentru comunicare"
                  persons={contacts}
                  onChange={setContacts}
                />
              </FormSection>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Delete Client Dialog - only when editing */}
      {!isCreating && client && (
        <DeleteClientDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          clientData={{
            id: client.id,
            name: client.name,
            caseCount: client.caseCount,
          }}
          onSuccess={() => {
            toast({
              title: 'Client șters',
              description: `Clientul "${client.name}" a fost șters.`,
              variant: 'success',
            });
            onClientDeleted?.();
          }}
        />
      )}

      {/* Create Mapa Modal - only when editing */}
      {!isCreating && client && (
        <CreateMapaModal
          open={showCreateMapaModal}
          onOpenChange={setShowCreateMapaModal}
          clientId={client.id}
          onSuccess={() => {
            toast({
              title: 'Mapă creată',
              description: 'Mapa a fost creată cu succes.',
              variant: 'success',
            });
            refetchMape();
          }}
        />
      )}
    </div>
  );
}

export default ClientDetailPanel;
