'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { type FetchResult } from '@apollo/client';
import {
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Building2,
  User,
  UserCircle,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { cn } from '@/lib/utils';
import { CREATE_CLIENT } from '@/graphql/mutations';

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

interface CustomRatesInput {
  partnerRate?: number;
  associateRate?: number;
  paralegalRate?: number;
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
  // Billing defaults
  billingType?: 'Hourly' | 'Fixed' | 'Retainer';
  fixedAmount?: number;
  customRates?: CustomRatesInput;
  retainerAmount?: number;
  retainerPeriod?: 'Monthly' | 'Quarterly' | 'Annually';
  retainerAutoRenew?: boolean;
  retainerRollover?: boolean;
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

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (clientId: string) => void;
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

const BILLING_OPTIONS = [
  { value: 'Hourly', label: 'Pe oră' },
  { value: 'Fixed', label: 'Sumă fixă' },
  { value: 'Retainer', label: 'Abonament' },
] as const;

const RETAINER_PERIODS = [
  { value: 'Monthly', label: 'Lunar' },
  { value: 'Quarterly', label: 'Trimestrial' },
  { value: 'Annually', label: 'Anual' },
] as const;

// ============================================================================
// Sub-components
// ============================================================================

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-linear-border-subtle bg-linear-bg-secondary p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg bg-linear-accent/10 flex items-center justify-center">
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
  disabled?: boolean;
}

function PersonList({ title, persons, onChange, disabled }: PersonListProps) {
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
          disabled={disabled}
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
                    disabled={disabled}
                  />
                  <Input
                    size="sm"
                    value={person.role}
                    onChange={(e) => updatePerson(index, 'role', e.target.value)}
                    placeholder="Funcție / Rol"
                    disabled={disabled}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePerson(index)}
                  disabled={disabled}
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
                  disabled={disabled}
                />
                <Input
                  size="sm"
                  type="tel"
                  value={person.phone || ''}
                  onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                  placeholder="Telefon"
                  disabled={disabled}
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

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const [createClient, { loading }] = useMutation<CreateClientResponse>(CREATE_CLIENT);
  const [localError, setLocalError] = useState<string | null>(null);

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

  // Form state - Billing defaults
  const [billingType, setBillingType] = useState<'Hourly' | 'Fixed' | 'Retainer'>('Hourly');
  const [fixedAmount, setFixedAmount] = useState('');
  const [partnerRate, setPartnerRate] = useState('');
  const [associateRate, setAssociateRate] = useState('');
  const [paralegalRate, setParalegalRate] = useState('');
  const [retainerAmount, setRetainerAmount] = useState('');
  const [retainerPeriod, setRetainerPeriod] = useState<'Monthly' | 'Quarterly' | 'Annually' | ''>(
    ''
  );
  const [retainerAutoRenew, setRetainerAutoRenew] = useState(false);
  const [retainerRollover, setRetainerRollover] = useState(false);

  // Validation state
  const [showErrors, setShowErrors] = useState(false);

  const resetForm = () => {
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
    // Reset billing
    setBillingType('Hourly');
    setFixedAmount('');
    setPartnerRate('');
    setAssociateRate('');
    setParalegalRate('');
    setRetainerAmount('');
    setRetainerPeriod('');
    setRetainerAutoRenew(false);
    setRetainerRollover(false);
    setShowErrors(false);
    setLocalError(null);
  };

  const handleCreate = async () => {
    setShowErrors(true);
    setLocalError(null);

    try {
      const input: CreateClientInput = {
        // Apply default name if empty
        name: name.trim() || 'Draft client',
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
        // Billing defaults
        billingType,
        fixedAmount: billingType === 'Fixed' && fixedAmount ? parseFloat(fixedAmount) : undefined,
        customRates:
          partnerRate || associateRate || paralegalRate
            ? {
                partnerRate: partnerRate ? parseFloat(partnerRate) : undefined,
                associateRate: associateRate ? parseFloat(associateRate) : undefined,
                paralegalRate: paralegalRate ? parseFloat(paralegalRate) : undefined,
              }
            : undefined,
        retainerAmount:
          billingType === 'Retainer' && retainerAmount ? parseFloat(retainerAmount) : undefined,
        retainerPeriod: billingType === 'Retainer' && retainerPeriod ? retainerPeriod : undefined,
        retainerAutoRenew: billingType === 'Retainer' ? retainerAutoRenew : undefined,
        retainerRollover: billingType === 'Retainer' ? retainerRollover : undefined,
      };

      const result = (await createClient({
        variables: { input },
        refetchQueries: ['GetClients', 'GetClientsWithCases'],
      })) as FetchResult<CreateClientResponse>;

      if (result.errors && result.errors.length > 0) {
        console.error('[CreateClientDialog] GraphQL errors:', result.errors);
        setLocalError(result.errors[0].message);
        return;
      }

      if (!result.data?.createClient) {
        setLocalError('Nu s-a putut crea clientul. Încercați din nou.');
        return;
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.(result.data.createClient.id);
    } catch (err) {
      console.error('[CreateClientDialog] Failed to create client:', err);
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Nu s-a putut crea clientul. Încercați din nou.');
      }
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-linear-accent/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-linear-accent" />
            </div>
            <DialogTitle>Client nou</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Completează detaliile pentru a crea un client nou.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Basic Info */}
                <FormSection
                  title="Informații de bază"
                  icon={<UserCircle className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel>Nume client</FieldLabel>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ex: SC Exemplu SRL sau Ion Popescu"
                        disabled={loading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <FieldLabel>Email</FieldLabel>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contact@exemplu.ro"
                          disabled={loading}
                          leftAddon={<Mail className="w-4 h-4" />}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Telefon</FieldLabel>
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+40 700 000 000"
                          disabled={loading}
                          leftAddon={<Phone className="w-4 h-4" />}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel>Adresă</FieldLabel>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Str. Exemplu nr. 1, București"
                        disabled={loading}
                        leftAddon={<MapPin className="w-4 h-4" />}
                      />
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
                          disabled={loading}
                          className={cn(
                            'px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2',
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
                          disabled={loading}
                          className={cn(
                            'px-3 py-2 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2',
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
                            disabled={loading}
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
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <FieldLabel>CUI / Cod Fiscal</FieldLabel>
                            <Input
                              value={cui}
                              onChange={(e) => setCui(e.target.value)}
                              placeholder="ex: RO12345678"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel>Nr. Registru Comerț</FieldLabel>
                            <Input
                              value={registrationNumber}
                              onChange={(e) => setRegistrationNumber(e.target.value)}
                              placeholder="ex: J40/123/2020"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </FormSection>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Administrators - only for companies */}
                {clientType === 'company' && (
                  <FormSection
                    title="Administratori"
                    icon={<UserCircle className="w-4 h-4 text-linear-accent" />}
                  >
                    <PersonList
                      title="Persoane cu funcții de conducere"
                      persons={administrators}
                      onChange={setAdministrators}
                      disabled={loading}
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
                    disabled={loading}
                  />
                </FormSection>

                {/* Billing Defaults */}
                <FormSection
                  title="Facturare (defaults pentru dosare noi)"
                  icon={<Wallet className="w-4 h-4 text-linear-accent" />}
                >
                  <div className="space-y-4">
                    {/* Billing Type Toggle */}
                    <div className="space-y-2">
                      <FieldLabel>Tip facturare</FieldLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {BILLING_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBillingType(option.value)}
                            disabled={loading}
                            className={cn(
                              'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                              billingType === option.value
                                ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                                : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fixed Amount */}
                    {billingType === 'Fixed' && (
                      <div className="space-y-2">
                        <FieldLabel>Sumă fixă (EUR)</FieldLabel>
                        <Input
                          type="number"
                          value={fixedAmount}
                          onChange={(e) => setFixedAmount(e.target.value)}
                          placeholder="ex: 5000"
                          disabled={loading}
                        />
                      </div>
                    )}

                    {/* Retainer Fields */}
                    {billingType === 'Retainer' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <FieldLabel>Sumă abonament (EUR)</FieldLabel>
                            <Input
                              type="number"
                              value={retainerAmount}
                              onChange={(e) => setRetainerAmount(e.target.value)}
                              placeholder="ex: 2000"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel>Perioadă</FieldLabel>
                            <select
                              value={retainerPeriod}
                              onChange={(e) =>
                                setRetainerPeriod(
                                  e.target.value as 'Monthly' | 'Quarterly' | 'Annually'
                                )
                              }
                              disabled={loading}
                              className="w-full h-10 px-3 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-sm text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent/50"
                            >
                              <option value="">Selectează perioada</option>
                              {RETAINER_PERIODS.map((period) => (
                                <option key={period.value} value={period.value}>
                                  {period.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm text-linear-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={retainerAutoRenew}
                              onChange={(e) => setRetainerAutoRenew(e.target.checked)}
                              disabled={loading}
                              className="w-4 h-4 rounded border-linear-border-subtle bg-linear-bg-tertiary text-linear-accent focus:ring-linear-accent/50"
                            />
                            Reînnoire automată
                          </label>
                          <label className="flex items-center gap-2 text-sm text-linear-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={retainerRollover}
                              onChange={(e) => setRetainerRollover(e.target.checked)}
                              disabled={loading}
                              className="w-4 h-4 rounded border-linear-border-subtle bg-linear-bg-tertiary text-linear-accent focus:ring-linear-accent/50"
                            />
                            Transfer ore neutilizate
                          </label>
                        </div>
                      </>
                    )}

                    {/* Custom Rates */}
                    {billingType === 'Hourly' && (
                      <div className="space-y-3">
                        <span className="text-sm text-linear-text-muted">
                          Tarife orare personalizate
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <span className="text-xs text-linear-text-tertiary">Partner</span>
                            <Input
                              type="number"
                              size="sm"
                              value={partnerRate}
                              onChange={(e) => setPartnerRate(e.target.value)}
                              placeholder="EUR/h"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-linear-text-tertiary">Asociat</span>
                            <Input
                              type="number"
                              size="sm"
                              value={associateRate}
                              onChange={(e) => setAssociateRate(e.target.value)}
                              placeholder="EUR/h"
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-linear-text-tertiary">Paralegal</span>
                            <Input
                              type="number"
                              size="sm"
                              value={paralegalRate}
                              onChange={(e) => setParalegalRate(e.target.value)}
                              placeholder="EUR/h"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </FormSection>
              </div>
            </div>

            {/* Error message */}
            {localError && (
              <div className="mt-4 p-3 rounded-md bg-linear-error/10 border border-linear-error/20">
                <p className="text-sm text-linear-error">{localError}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            Anulează
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={loading}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Creează client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

CreateClientDialog.displayName = 'CreateClientDialog';

export default CreateClientDialog;
