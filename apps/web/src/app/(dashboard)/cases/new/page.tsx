'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Users,
  Mail,
  CreditCard,
  Building2,
  UserCircle,
  Search,
  Plus,
  Check,
  Phone,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { TagInput } from '@/components/cases/TagInput';
import { type Client } from '@/hooks/mobile/useClientSearch';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { CaseTypeSelect } from '@/components/cases/CaseTypeSelect';
import { CompanyDetailsForm, type CompanyDetails } from '@/components/clients/CompanyDetailsForm';
import { useCreateCase, type CreateCaseInput } from '@/hooks/mobile/useCreateCase';
import { useClientSearch } from '@/hooks/mobile/useClientSearch';
import { GET_CASE_TYPES } from '@/graphql/queries';
import { cn } from '@/lib/utils';

type TabType = 'case' | 'client';

const BILLING_OPTIONS = [
  { value: 'HOURLY', label: 'Pe oră' },
  { value: 'FIXED', label: 'Sumă fixă' },
];

interface CaseTypeConfig {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

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

// Default empty company details
const defaultCompanyDetails: CompanyDetails = {
  clientType: 'company',
  administrators: [],
  contacts: [],
};

export default function NewCasePage() {
  const router = useRouter();
  const { createCase, loading: submitting, error: submitError, validate } = useCreateCase();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('client');

  // Fetch case types
  const { data: caseTypesData } = useQuery<{ caseTypeConfigs: CaseTypeConfig[] }>(GET_CASE_TYPES, {
    variables: { includeInactive: false },
  });

  // Client search
  const {
    clients: searchResults,
    loading: searchLoading,
    search: searchClients,
  } = useClientSearch();
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);

  // Form state - Case
  const [title, setTitle] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamAssignment[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [courtFileNumbers, setCourtFileNumbers] = useState<string[]>([]);
  const [billingType, setBillingType] = useState<'HOURLY' | 'FIXED'>('HOURLY');
  const [fixedAmount, setFixedAmount] = useState('');
  const [partnerRate, setPartnerRate] = useState('');
  const [associateRate, setAssociateRate] = useState('');
  const [paralegalRate, setParalegalRate] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  // Form state - New Client
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>(defaultCompanyDetails);

  // Custom case types added during this session
  const [customCaseTypes, setCustomCaseTypes] = useState<{ value: string; label: string }[]>([]);

  // Validation errors
  const [showErrors, setShowErrors] = useState(false);

  // Determine if this is a new client (empty ID) or existing client
  const isNewClient = client && !client.id;

  // Build input for validation
  const formInput: Partial<CreateCaseInput> = {
    title: title.trim(),
    // Always include clientName (backend requires it)
    // clientId is kept for frontend validation but not sent to backend
    clientId: isNewClient ? undefined : client?.id,
    clientName: client?.name,
    type,
    description: description.trim(),
    teamMembers: teamMembers.map((tm) => ({ userId: tm.userId, role: tm.role })),
    keywords,
    emailDomains,
    courtFileNumbers,
    billingType,
    fixedAmount: fixedAmount ? parseFloat(fixedAmount) : undefined,
    hourlyRates:
      billingType === 'HOURLY'
        ? {
            partner: partnerRate ? parseFloat(partnerRate) : undefined,
            associate: associateRate ? parseFloat(associateRate) : undefined,
            paralegal: paralegalRate ? parseFloat(paralegalRate) : undefined,
          }
        : undefined,
    estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
  };

  // Custom validation that accepts either clientId OR clientName
  const baseErrors = validate(formInput);
  // Remove clientId error if we have clientName
  if (isNewClient && client?.name && baseErrors.clientId) {
    delete baseErrors.clientId;
  }
  const errors = baseErrors;
  const hasErrors = Object.keys(errors).length > 0;

  // Build options from fetched types (start with empty list, no defaults)
  const backendCaseTypes = caseTypesData?.caseTypeConfigs?.length
    ? caseTypesData.caseTypeConfigs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ct) => ({ value: ct.code, label: ct.name }))
    : [];

  // Combine backend types with custom types added this session
  const caseTypeOptions = [...backendCaseTypes, ...customCaseTypes];

  // Handler for adding new case type
  const handleAddCaseType = (newType: { value: string; label: string }) => {
    if (!caseTypeOptions.some((opt) => opt.value === newType.value)) {
      setCustomCaseTypes((prev) => [...prev, newType]);
    }
  };

  // Handle client search
  const handleClientSearch = (query: string) => {
    setClientSearchQuery(query);
    if (query.length >= 2) {
      searchClients(query);
    }
  };

  // Handle client selection
  const handleSelectClient = (selectedClient: Client) => {
    setClient(selectedClient);
    setIsCreatingNewClient(false);
    setClientSearchQuery('');
  };

  // Handle creating new client - stores locally (backend will create with case)
  const handleCreateNewClient = () => {
    if (!newClientName.trim()) return;

    // Build contact info from email and phone
    const contactParts = [];
    if (newClientEmail.trim()) contactParts.push(newClientEmail.trim());
    if (newClientPhone.trim()) contactParts.push(newClientPhone.trim());

    // Create a local client object - the backend will create the client with the case
    // using the clientName field
    setClient({
      id: '', // Empty ID signals this is a new client
      name: newClientName.trim(),
      contactInfo: contactParts.join(' | ') || '',
      address: newClientAddress.trim() || '',
    });
    setIsCreatingNewClient(false);
    // Clear form
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientAddress('');
    setCompanyDetails(defaultCompanyDetails);
  };

  const handleSubmit = async () => {
    setShowErrors(true);

    if (hasErrors) {
      return;
    }

    if (submitting) return;

    try {
      const result = await createCase(formInput as CreateCaseInput);

      if (result) {
        router.push(`/cases`);
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    }
  };

  // Domain validation for email domains
  const validateDomain = (domain: string): boolean => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(domain);
  };

  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary">
      {/* Header */}
      <div className="px-8 py-5 border-b border-linear-border-subtle flex-shrink-0 bg-linear-bg-primary/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-linear-bg-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-linear-text-secondary" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-linear-text-primary">Dosar Nou</h1>
              <p className="text-xs text-linear-text-tertiary">
                Completează detaliile pentru a crea un dosar nou
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" onClick={() => router.back()}>
              Anulează
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || !client}
              leftIcon={<Briefcase className="w-4 h-4" />}
            >
              {submitting ? 'Se creează...' : 'Creează Dosar'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-5 border-b border-linear-border-subtle">
          <button
            onClick={() => setActiveTab('client')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === 'client'
                ? 'text-linear-accent'
                : 'text-linear-text-tertiary hover:text-linear-text-secondary'
            )}
          >
            <div className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Client
              {client && <span className="w-2 h-2 rounded-full bg-linear-success" />}
            </div>
            {activeTab === 'client' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-accent" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('case')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === 'case'
                ? 'text-linear-accent'
                : 'text-linear-text-tertiary hover:text-linear-text-secondary'
            )}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Detalii Dosar
            </div>
            {activeTab === 'case' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full">
        <div className="px-8 py-8">
          {/* Client Tab */}
          {activeTab === 'client' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Search & Select */}
              <div className="space-y-6">
                <FormSection
                  title="Selectează Client"
                  icon={<Search className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    {/* Search Input */}
                    <div className="space-y-2">
                      <FieldLabel>Caută client existent</FieldLabel>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-muted" />
                        <Input
                          size="lg"
                          value={clientSearchQuery}
                          onChange={(e) => handleClientSearch(e.target.value)}
                          placeholder="Caută după nume, CUI sau email..."
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Search Results */}
                    {clientSearchQuery.length >= 2 && (
                      <div className="border border-linear-border-subtle rounded-lg overflow-hidden">
                        {searchLoading ? (
                          <div className="p-4 text-center text-sm text-linear-text-tertiary">
                            Se caută...
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto">
                            {searchResults.map((searchClient) => (
                              <button
                                key={searchClient.id}
                                onClick={() => handleSelectClient(searchClient)}
                                className={cn(
                                  'w-full text-left px-4 py-3 border-b border-linear-border-subtle last:border-b-0',
                                  'hover:bg-linear-bg-hover transition-colors',
                                  client?.id === searchClient.id && 'bg-linear-accent/10'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-linear-text-primary">
                                      {searchClient.name}
                                    </p>
                                    {searchClient.address && (
                                      <p className="text-xs text-linear-text-tertiary mt-0.5">
                                        {searchClient.address}
                                      </p>
                                    )}
                                  </div>
                                  {client?.id === searchClient.id && (
                                    <Check className="w-4 h-4 text-linear-accent" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-sm text-linear-text-tertiary">
                            Niciun client găsit
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selected Client Display */}
                    {client && !isCreatingNewClient && (
                      <div className="p-4 rounded-lg bg-linear-accent/10 border border-linear-accent/20">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-linear-accent/20 flex items-center justify-center">
                              <UserCircle className="w-5 h-5 text-linear-accent" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-linear-text-primary">
                                {client.name}
                              </p>
                              {client.address && (
                                <p className="text-xs text-linear-text-secondary mt-0.5">
                                  {client.address}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setClient(null)}>
                            Schimbă
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Create New Client Button */}
                    {!client && !isCreatingNewClient && (
                      <button
                        onClick={() => setIsCreatingNewClient(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-linear-border-subtle text-sm font-medium text-linear-text-secondary hover:border-linear-accent hover:text-linear-accent transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Creează client nou
                      </button>
                    )}
                  </div>
                </FormSection>
              </div>

              {/* Right Column - New Client Form */}
              <div className="space-y-6">
                {isCreatingNewClient && (
                  <>
                    <FormSection
                      title="Client Nou"
                      icon={<UserCircle className="w-4 h-4 text-linear-accent" />}
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <FieldLabel required>Nume client</FieldLabel>
                          <Input
                            size="lg"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="ex: SC Exemplu SRL sau Ion Popescu"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <FieldLabel>Email</FieldLabel>
                            <Input
                              size="lg"
                              type="email"
                              value={newClientEmail}
                              onChange={(e) => setNewClientEmail(e.target.value)}
                              placeholder="contact@exemplu.ro"
                              leftAddon={<Mail className="w-4 h-4" />}
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel>Telefon</FieldLabel>
                            <Input
                              size="lg"
                              type="tel"
                              value={newClientPhone}
                              onChange={(e) => setNewClientPhone(e.target.value)}
                              placeholder="+40 700 000 000"
                              leftAddon={<Phone className="w-4 h-4" />}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <FieldLabel>Adresă</FieldLabel>
                          <Input
                            size="lg"
                            value={newClientAddress}
                            onChange={(e) => setNewClientAddress(e.target.value)}
                            placeholder="Str. Exemplu nr. 1, București"
                            leftAddon={<MapPin className="w-4 h-4" />}
                          />
                        </div>
                      </div>
                    </FormSection>

                    <FormSection
                      title="Detalii Companie"
                      icon={<Building2 className="w-4 h-4 text-linear-accent" />}
                    >
                      <CompanyDetailsForm value={companyDetails} onChange={setCompanyDetails} />
                    </FormSection>

                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setIsCreatingNewClient(false);
                          setNewClientName('');
                          setNewClientEmail('');
                          setNewClientPhone('');
                          setNewClientAddress('');
                          setCompanyDetails(defaultCompanyDetails);
                        }}
                        className="flex-1"
                      >
                        Anulează
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleCreateNewClient}
                        disabled={!newClientName.trim()}
                        className="flex-1"
                      >
                        Salvează Client
                      </Button>
                    </div>
                  </>
                )}

                {!isCreatingNewClient && client && (
                  <div className="flex items-center justify-center h-64 text-linear-text-tertiary">
                    <div className="text-center">
                      <Check className="w-12 h-12 mx-auto mb-3 text-linear-success" />
                      <p className="text-sm font-medium text-linear-text-primary">
                        Client selectat
                      </p>
                      <p className="text-xs text-linear-text-tertiary mt-1">
                        Poți continua la tab-ul &quot;Detalii Dosar&quot;
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-4"
                        onClick={() => setActiveTab('case')}
                      >
                        Continuă
                      </Button>
                    </div>
                  </div>
                )}

                {!isCreatingNewClient && !client && (
                  <div className="flex items-center justify-center h-64 text-linear-text-tertiary">
                    <div className="text-center">
                      <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Caută sau creează un client pentru a continua</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Case Tab */}
          {activeTab === 'case' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Main Info */}
              <div className="space-y-6">
                {/* Selected Client Summary */}
                {client && (
                  <div className="p-4 rounded-xl bg-linear-accent/5 border border-linear-accent/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-linear-accent/20 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-linear-accent" />
                      </div>
                      <div>
                        <p className="text-xs text-linear-text-tertiary">Client selectat</p>
                        <p className="text-sm font-semibold text-linear-text-primary">
                          {client.name}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('client')}>
                      Schimbă
                    </Button>
                  </div>
                )}

                {!client && (
                  <div className="p-4 rounded-xl bg-linear-warning/10 border border-linear-warning/20 flex items-center justify-between">
                    <p className="text-sm text-linear-warning">
                      Trebuie să selectezi un client pentru a continua
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setActiveTab('client')}>
                      Selectează Client
                    </Button>
                  </div>
                )}

                {/* Basic Info Section */}
                <FormSection
                  title="Informații de bază"
                  icon={<FileText className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel required>Titlu dosar</FieldLabel>
                      <Input
                        size="lg"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="ex: Smith v. Jones"
                        error={showErrors && !!errors.title}
                        errorMessage={showErrors ? errors.title : undefined}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel required>Tip dosar</FieldLabel>
                      <CaseTypeSelect
                        value={type}
                        onChange={setType}
                        options={caseTypeOptions}
                        onAddNew={handleAddCaseType}
                        placeholder="Selectează sau adaugă tip"
                        error={showErrors && !type}
                        errorMessage={
                          showErrors && !type ? 'Tipul dosarului este obligatoriu' : undefined
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel required>Descriere</FieldLabel>
                      <TextArea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descrieți pe scurt obiectul dosarului..."
                        rows={4}
                        error={showErrors && !!errors.description}
                        errorMessage={showErrors ? errors.description : undefined}
                      />
                    </div>
                  </div>
                </FormSection>

                {/* Team Section */}
                <FormSection title="Echipă" icon={<Users className="w-4 h-4 text-linear-accent" />}>
                  <TeamMemberSelect
                    label="Membri echipă *"
                    value={teamMembers}
                    onChange={setTeamMembers}
                    error={showErrors ? errors.teamMembers : undefined}
                  />
                </FormSection>

                {/* Court Info Section */}
                <FormSection
                  title="Informații instanță"
                  icon={<Building2 className="w-4 h-4 text-linear-accent" />}
                >
                  <TagInput
                    label="Numere dosar instanță"
                    placeholder="ex: 1234/3/2024"
                    value={courtFileNumbers}
                    onChange={setCourtFileNumbers}
                  />
                </FormSection>
              </div>

              {/* Right Column - Additional Info */}
              <div className="space-y-6">
                {/* Email Classification Section */}
                <FormSection
                  title="Clasificare Email"
                  icon={<Mail className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    <TagInput
                      label="Cuvinte cheie email"
                      placeholder="Adaugă cuvânt cheie..."
                      value={keywords}
                      onChange={setKeywords}
                    />
                    <TagInput
                      label="Domenii email"
                      placeholder="ex: client.ro"
                      value={emailDomains}
                      onChange={setEmailDomains}
                      validate={validateDomain}
                      error={
                        emailDomains.length > 0 && emailDomains.some((d) => !validateDomain(d))
                          ? 'Format invalid pentru domeniu'
                          : undefined
                      }
                    />
                  </div>
                </FormSection>

                {/* Billing Section */}
                <FormSection
                  title="Facturare"
                  icon={<CreditCard className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    {/* Billing Type Toggle */}
                    <div className="space-y-2">
                      <FieldLabel required>Tip facturare</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {BILLING_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBillingType(opt.value as 'HOURLY' | 'FIXED')}
                            className={cn(
                              'px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                              billingType === opt.value
                                ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                                : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {billingType === 'FIXED' && (
                      <div className="space-y-2">
                        <FieldLabel required>Sumă fixă (EUR)</FieldLabel>
                        <Input
                          size="lg"
                          type="number"
                          value={fixedAmount}
                          onChange={(e) => setFixedAmount(e.target.value)}
                          placeholder="ex: 5000"
                          error={showErrors && !!errors.fixedAmount}
                          errorMessage={showErrors ? errors.fixedAmount : undefined}
                        />
                      </div>
                    )}

                    {billingType === 'HOURLY' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <FieldLabel>Tarif partener (EUR/oră)</FieldLabel>
                          <Input
                            size="lg"
                            type="number"
                            value={partnerRate}
                            onChange={(e) => setPartnerRate(e.target.value)}
                            placeholder="ex: 500"
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Tarif asociat (EUR/oră)</FieldLabel>
                          <Input
                            size="lg"
                            type="number"
                            value={associateRate}
                            onChange={(e) => setAssociateRate(e.target.value)}
                            placeholder="ex: 300"
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>Tarif paralegal (EUR/oră)</FieldLabel>
                          <Input
                            size="lg"
                            type="number"
                            value={paralegalRate}
                            onChange={(e) => setParalegalRate(e.target.value)}
                            placeholder="ex: 150"
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-linear-border-subtle">
                      <div className="space-y-2">
                        <FieldLabel>Valoare estimată (EUR)</FieldLabel>
                        <Input
                          size="lg"
                          type="number"
                          value={estimatedValue}
                          onChange={(e) => setEstimatedValue(e.target.value)}
                          placeholder="ex: 50000"
                        />
                      </div>
                    </div>
                  </div>
                </FormSection>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submitError && (
            <div className="mt-6 p-4 rounded-xl bg-linear-error/10 border border-linear-error/20">
              <p className="text-sm text-linear-error">
                Nu s-a putut crea dosarul. Încercați din nou.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
