'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import {
  ChevronLeft,
  Loader2,
  Search,
  Plus,
  Check,
  UserCircle,
  Briefcase,
  Trash2,
} from 'lucide-react';
import {
  MobileInput,
  MobileTextArea,
  MobileSelect,
  InlineError,
  TagInput,
  TeamMemberSelect,
  CaseTypeSelect,
  type TeamAssignment,
} from '@/components/mobile';
import { useCreateCase, type CreateCaseInput } from '@/hooks/mobile';
import { useClientSearch, type Client } from '@/hooks/mobile/useClientSearch';
import {
  type CompanyDetails,
  type Administrator,
  type Contact,
} from '@/components/clients/CompanyDetailsForm';
import { GET_CASE_TYPES } from '@/graphql/queries';
import { cn } from '@/lib/utils';

type TabType = 'client' | 'case';

const BILLING_OPTIONS = [
  { value: 'HOURLY', label: 'Pe oră' },
  { value: 'FIXED', label: 'Sumă fixă' },
];

const COMPANY_TYPE_OPTIONS = [
  { value: 'SRL', label: 'SRL' },
  { value: 'SA', label: 'SA' },
  { value: 'PFA', label: 'PFA' },
  { value: 'II', label: 'II' },
  { value: 'IF', label: 'IF' },
  { value: 'Other', label: 'Altele' },
];

interface CaseTypeConfig {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
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

  // Build input for validation
  const formInput: Partial<CreateCaseInput> = {
    title: title.trim(),
    clientId: client?.id,
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

  const errors = validate(formInput);
  const hasErrors = Object.keys(errors).length > 0;

  // Build options from fetched types
  const backendCaseTypes = caseTypesData?.caseTypeConfigs?.length
    ? caseTypesData.caseTypeConfigs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ct) => ({ value: ct.code, label: ct.name }))
    : [];

  const caseTypeOptions = [...backendCaseTypes, ...customCaseTypes];

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

  // Handle creating new client
  const handleCreateNewClient = () => {
    if (!newClientName.trim()) return;

    const contactParts = [];
    if (newClientEmail.trim()) contactParts.push(newClientEmail.trim());
    if (newClientPhone.trim()) contactParts.push(newClientPhone.trim());

    const newClient: Client = {
      id: `new-${Date.now()}`,
      name: newClientName.trim(),
      contactInfo: contactParts.join(' | ') || '',
      address: newClientAddress.trim() || '',
    };

    setClient(newClient);
    setIsCreatingNewClient(false);
  };

  // Administrator handlers
  const addAdministrator = () => {
    const newAdmin: Administrator = {
      id: crypto.randomUUID(),
      name: '',
      role: 'Administrator',
    };
    setCompanyDetails((prev) => ({
      ...prev,
      administrators: [...prev.administrators, newAdmin],
    }));
  };

  const updateAdministrator = (id: string, field: keyof Administrator, value: string) => {
    setCompanyDetails((prev) => ({
      ...prev,
      administrators: prev.administrators.map((admin) =>
        admin.id === id ? { ...admin, [field]: value } : admin
      ),
    }));
  };

  const removeAdministrator = (id: string) => {
    setCompanyDetails((prev) => ({
      ...prev,
      administrators: prev.administrators.filter((admin) => admin.id !== id),
    }));
  };

  // Contact handlers
  const addContact = () => {
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
    };
    setCompanyDetails((prev) => ({
      ...prev,
      contacts: [...prev.contacts, newContact],
    }));
  };

  const updateContact = (id: string, field: keyof Contact, value: string) => {
    setCompanyDetails((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const removeContact = (id: string) => {
    setCompanyDetails((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((contact) => contact.id !== id),
    }));
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (hasErrors || submitting) return;

    try {
      const result = await createCase(formInput as CreateCaseInput);
      if (result) {
        router.push(`/m/cases/${result.id}`);
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    }
  };

  const validateDomain = (domain: string): boolean => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(domain);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="animate-fadeIn min-h-screen flex flex-col bg-mobile-bg-primary">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
        <button
          onClick={handleBack}
          className="w-8 h-8 -ml-2 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-medium tracking-[-0.02em]">Dosar Nou</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-mobile-border-subtle">
        <button
          onClick={() => setActiveTab('client')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-[14px] font-medium transition-colors relative',
            activeTab === 'client' ? 'text-mobile-accent' : 'text-mobile-text-tertiary'
          )}
        >
          <UserCircle className="w-4 h-4" strokeWidth={2} />
          Client
          {client && <span className="w-2 h-2 rounded-full bg-mobile-success" />}
          {activeTab === 'client' && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-mobile-accent rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('case')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-[14px] font-medium transition-colors relative',
            activeTab === 'case' ? 'text-mobile-accent' : 'text-mobile-text-tertiary'
          )}
        >
          <Briefcase className="w-4 h-4" strokeWidth={2} />
          Detalii Dosar
          {activeTab === 'case' && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-mobile-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 px-6 py-6 pb-32 overflow-y-auto">
        {/* Client Tab */}
        {activeTab === 'client' && (
          <div className="space-y-6">
            {/* Search Section */}
            <section className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                Selectează Client
              </h3>

              {/* Search Input */}
              <div className="relative">
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-[12px] bg-mobile-bg-elevated border border-mobile-border">
                  <Search className="w-[18px] h-[18px] text-mobile-text-tertiary" strokeWidth={2} />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    placeholder="Caută după nume, CUI sau email..."
                    className="flex-1 bg-transparent text-[15px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                  />
                </div>

                {/* Search Results Dropdown */}
                {clientSearchQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-mobile-bg-elevated border border-mobile-border rounded-[12px] overflow-hidden shadow-lg">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2
                          className="w-5 h-5 text-mobile-text-tertiary animate-spin"
                          strokeWidth={2}
                        />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto">
                        {searchResults.map((searchClient) => (
                          <button
                            key={searchClient.id}
                            onClick={() => handleSelectClient(searchClient)}
                            className={cn(
                              'w-full text-left px-4 py-3 border-b border-mobile-border-subtle last:border-b-0',
                              'hover:bg-mobile-bg-hover transition-colors',
                              client?.id === searchClient.id && 'bg-mobile-accent/10'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[15px] font-medium text-mobile-text-primary">
                                  {searchClient.name}
                                </p>
                                {searchClient.address && (
                                  <p className="text-[13px] text-mobile-text-secondary mt-0.5">
                                    {searchClient.address}
                                  </p>
                                )}
                              </div>
                              {client?.id === searchClient.id && (
                                <Check className="w-4 h-4 text-mobile-accent" strokeWidth={2} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-[14px] text-mobile-text-tertiary">
                        Niciun client găsit
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Client Display */}
              {client && !isCreatingNewClient && (
                <div className="p-4 rounded-[12px] bg-mobile-accent/10 border border-mobile-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-mobile-accent/20 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-mobile-accent" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-mobile-text-primary">
                          {client.name}
                        </p>
                        {client.address && (
                          <p className="text-[13px] text-mobile-text-secondary mt-0.5">
                            {client.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setClient(null)}
                      className="text-[14px] text-mobile-accent font-medium"
                    >
                      Schimbă
                    </button>
                  </div>
                </div>
              )}

              {/* Create New Client Button */}
              {!client && !isCreatingNewClient && (
                <button
                  onClick={() => setIsCreatingNewClient(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] border border-dashed border-mobile-border text-[15px] font-medium text-mobile-text-secondary hover:border-mobile-accent hover:text-mobile-accent transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Creează client nou
                </button>
              )}
            </section>

            {/* New Client Form */}
            {isCreatingNewClient && (
              <section className="space-y-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                  Client Nou
                </h3>

                <MobileInput
                  label="Nume client *"
                  placeholder="ex: SC Exemplu SRL sau Ion Popescu"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />

                <MobileInput
                  label="Email"
                  type="email"
                  placeholder="contact@exemplu.ro"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                />

                <MobileInput
                  label="Telefon"
                  type="tel"
                  placeholder="+40 700 000 000"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />

                <MobileInput
                  label="Adresă"
                  placeholder="Str. Exemplu nr. 1, București"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                />

                {/* Client Type Toggle */}
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-mobile-text-secondary">
                    Tip client
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        'flex-1 px-4 py-3 rounded-[12px] border text-[14px] font-medium transition-colors',
                        companyDetails.clientType === 'individual'
                          ? 'border-mobile-accent bg-mobile-accent/10 text-mobile-accent'
                          : 'border-mobile-border bg-mobile-bg-elevated text-mobile-text-tertiary'
                      )}
                      onClick={() =>
                        setCompanyDetails((prev) => ({ ...prev, clientType: 'individual' }))
                      }
                    >
                      Persoană Fizică
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex-1 px-4 py-3 rounded-[12px] border text-[14px] font-medium transition-colors',
                        companyDetails.clientType === 'company'
                          ? 'border-mobile-accent bg-mobile-accent/10 text-mobile-accent'
                          : 'border-mobile-border bg-mobile-bg-elevated text-mobile-text-tertiary'
                      )}
                      onClick={() =>
                        setCompanyDetails((prev) => ({ ...prev, clientType: 'company' }))
                      }
                    >
                      Persoană Juridică
                    </button>
                  </div>
                </div>

                {/* Company-specific fields */}
                {companyDetails.clientType === 'company' && (
                  <>
                    <MobileSelect
                      label="Forma juridică"
                      options={COMPANY_TYPE_OPTIONS}
                      value={companyDetails.companyType || ''}
                      onChange={(e) =>
                        setCompanyDetails((prev) => ({
                          ...prev,
                          companyType: e.target.value as CompanyDetails['companyType'],
                        }))
                      }
                    />

                    <MobileInput
                      label="CUI / Cod Fiscal"
                      placeholder="ex: RO12345678"
                      value={companyDetails.cui || ''}
                      onChange={(e) =>
                        setCompanyDetails((prev) => ({ ...prev, cui: e.target.value }))
                      }
                    />

                    <MobileInput
                      label="Număr Registru Comerț"
                      placeholder="ex: J40/1234/2020"
                      value={companyDetails.registrationNumber || ''}
                      onChange={(e) =>
                        setCompanyDetails((prev) => ({
                          ...prev,
                          registrationNumber: e.target.value,
                        }))
                      }
                    />

                    {/* Administrators */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-medium text-mobile-text-secondary">
                          Administratori
                        </label>
                        <button
                          type="button"
                          onClick={addAdministrator}
                          className="text-[14px] text-mobile-accent font-medium flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2} />
                          Adaugă
                        </button>
                      </div>

                      {companyDetails.administrators.length === 0 ? (
                        <p className="text-[14px] text-mobile-text-tertiary py-2">
                          Nu există administratori adăugați
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {companyDetails.administrators.map((admin) => (
                            <div
                              key={admin.id}
                              className="p-3 bg-mobile-bg-elevated rounded-[12px] border border-mobile-border space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-3">
                                  <input
                                    type="text"
                                    value={admin.name}
                                    onChange={(e) =>
                                      updateAdministrator(admin.id, 'name', e.target.value)
                                    }
                                    placeholder="Nume complet"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={admin.role}
                                    onChange={(e) =>
                                      updateAdministrator(admin.id, 'role', e.target.value)
                                    }
                                    placeholder="Funcție"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="email"
                                    value={admin.email || ''}
                                    onChange={(e) =>
                                      updateAdministrator(admin.id, 'email', e.target.value)
                                    }
                                    placeholder="Email"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="tel"
                                    value={admin.phone || ''}
                                    onChange={(e) =>
                                      updateAdministrator(admin.id, 'phone', e.target.value)
                                    }
                                    placeholder="Telefon"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAdministrator(admin.id)}
                                  className="ml-2 p-2 text-mobile-text-tertiary hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Contacts */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-medium text-mobile-text-secondary">
                          Persoane de contact
                        </label>
                        <button
                          type="button"
                          onClick={addContact}
                          className="text-[14px] text-mobile-accent font-medium flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2} />
                          Adaugă
                        </button>
                      </div>

                      {companyDetails.contacts.length === 0 ? (
                        <p className="text-[14px] text-mobile-text-tertiary py-2">
                          Nu există persoane de contact adăugate
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {companyDetails.contacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="p-3 bg-mobile-bg-elevated rounded-[12px] border border-mobile-border space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-3">
                                  <input
                                    type="text"
                                    value={contact.name}
                                    onChange={(e) =>
                                      updateContact(contact.id, 'name', e.target.value)
                                    }
                                    placeholder="Nume complet"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={contact.role}
                                    onChange={(e) =>
                                      updateContact(contact.id, 'role', e.target.value)
                                    }
                                    placeholder="Rol (ex: Contabil, Secretar)"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="email"
                                    value={contact.email || ''}
                                    onChange={(e) =>
                                      updateContact(contact.id, 'email', e.target.value)
                                    }
                                    placeholder="Email"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                  <input
                                    type="tel"
                                    value={contact.phone || ''}
                                    onChange={(e) =>
                                      updateContact(contact.id, 'phone', e.target.value)
                                    }
                                    placeholder="Telefon"
                                    className="w-full px-3 py-2 rounded-lg bg-mobile-bg-card border border-mobile-border text-[14px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeContact(contact.id)}
                                  className="ml-2 p-2 text-mobile-text-tertiary hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewClient(false);
                      setNewClientName('');
                      setNewClientEmail('');
                      setNewClientPhone('');
                      setNewClientAddress('');
                      setCompanyDetails(defaultCompanyDetails);
                    }}
                    className="flex-1 py-3 rounded-[12px] border border-mobile-border text-[15px] font-medium text-mobile-text-secondary"
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    disabled={!newClientName.trim()}
                    className={cn(
                      'flex-1 py-3 rounded-[12px] text-[15px] font-medium transition-colors',
                      newClientName.trim()
                        ? 'bg-mobile-accent text-white'
                        : 'bg-mobile-bg-elevated text-mobile-text-tertiary'
                    )}
                  >
                    Salvează Client
                  </button>
                </div>
              </section>
            )}

            {/* Success State */}
            {client && !isCreatingNewClient && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-mobile-success/20 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-mobile-success" strokeWidth={2} />
                </div>
                <p className="text-[15px] font-medium text-mobile-text-primary mb-1">
                  Client selectat
                </p>
                <p className="text-[14px] text-mobile-text-tertiary mb-4">
                  Continuă la tab-ul &quot;Detalii Dosar&quot;
                </p>
                <button
                  onClick={() => setActiveTab('case')}
                  className="px-6 py-2.5 rounded-full bg-mobile-accent text-white text-[14px] font-medium"
                >
                  Continuă
                </button>
              </div>
            )}
          </div>
        )}

        {/* Case Tab */}
        {activeTab === 'case' && (
          <div className="space-y-6">
            {/* Client Summary */}
            {client ? (
              <div className="p-3 rounded-[12px] bg-mobile-accent/5 border border-mobile-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-mobile-accent/20 flex items-center justify-center">
                    <UserCircle className="w-4 h-4 text-mobile-accent" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[11px] text-mobile-text-tertiary">Client</p>
                    <p className="text-[14px] font-medium text-mobile-text-primary">
                      {client.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('client')}
                  className="text-[13px] text-mobile-accent font-medium"
                >
                  Schimbă
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-[12px] bg-mobile-warning/10 border border-mobile-warning/20 flex items-center justify-between">
                <p className="text-[14px] text-mobile-warning">Selectează un client</p>
                <button
                  onClick={() => setActiveTab('client')}
                  className="text-[13px] text-mobile-warning font-medium"
                >
                  Selectează
                </button>
              </div>
            )}

            {/* Basic Info Section */}
            <section className="space-y-5">
              <MobileInput
                label="Titlu dosar *"
                placeholder="ex: Smith v. Jones"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={showErrors ? errors.title : undefined}
              />

              <CaseTypeSelect
                label="Tip dosar *"
                placeholder="Selectează sau adaugă tip"
                options={caseTypeOptions}
                value={type}
                onChange={setType}
                onAddNew={handleAddCaseType}
                error={showErrors && !type ? 'Tipul dosarului este obligatoriu' : undefined}
              />

              <MobileTextArea
                label="Descriere *"
                placeholder="Descrieți pe scurt obiectul dosarului..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={showErrors ? errors.description : undefined}
              />
            </section>

            {/* Team Section */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                Echipă
              </h3>
              <TeamMemberSelect
                label="Membri echipă *"
                value={teamMembers}
                onChange={setTeamMembers}
                error={showErrors ? errors.teamMembers : undefined}
              />
            </section>

            {/* Email Classification Section */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                Clasificare Email
              </h3>
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
            </section>

            {/* Court Info Section */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                Informații Instanță
              </h3>
              <TagInput
                label="Numere dosar instanță"
                placeholder="ex: 1234/3/2024"
                value={courtFileNumbers}
                onChange={setCourtFileNumbers}
              />
            </section>

            {/* Billing Section */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
                Facturare
              </h3>
              <MobileSelect
                label="Tip facturare *"
                options={BILLING_OPTIONS}
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as 'HOURLY' | 'FIXED')}
              />

              {billingType === 'FIXED' && (
                <MobileInput
                  label="Sumă fixă (EUR) *"
                  placeholder="ex: 5000"
                  type="number"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  error={showErrors ? errors.fixedAmount : undefined}
                />
              )}

              {billingType === 'HOURLY' && (
                <div className="space-y-3">
                  <MobileInput
                    label="Tarif partener (EUR/oră)"
                    placeholder="ex: 500"
                    type="number"
                    value={partnerRate}
                    onChange={(e) => setPartnerRate(e.target.value)}
                  />
                  <MobileInput
                    label="Tarif asociat (EUR/oră)"
                    placeholder="ex: 300"
                    type="number"
                    value={associateRate}
                    onChange={(e) => setAssociateRate(e.target.value)}
                  />
                  <MobileInput
                    label="Tarif paralegal (EUR/oră)"
                    placeholder="ex: 150"
                    type="number"
                    value={paralegalRate}
                    onChange={(e) => setParalegalRate(e.target.value)}
                  />
                </div>
              )}

              <MobileInput
                label="Valoare estimată (EUR)"
                placeholder="ex: 50000"
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </section>

            {submitError && (
              <InlineError
                message="Nu s-a putut crea dosarul. Încercați din nou."
                onRetry={handleSubmit}
              />
            )}
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-mobile-bg-primary border-t border-mobile-border px-6 py-4 pb-8 z-50">
        <button
          onClick={handleSubmit}
          disabled={submitting || !client || hasErrors}
          className={cn(
            'w-full py-3.5 rounded-[12px] font-medium text-[15px] transition-all',
            'flex items-center justify-center gap-2',
            client && !hasErrors && !submitting
              ? 'bg-mobile-text-primary text-mobile-bg-primary active:scale-[0.98]'
              : 'bg-mobile-bg-elevated text-mobile-text-tertiary cursor-not-allowed'
          )}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
          Creează Dosar
        </button>
      </div>
    </div>
  );
}
