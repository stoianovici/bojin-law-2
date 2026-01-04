'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';
import { cn } from '@/lib/utils';

// Note: Select components still used for companyType dropdown

// Company types in Romania
export type CompanyType = 'SRL' | 'SA' | 'PFA' | 'II' | 'IF' | 'SNC' | 'SCS' | 'SCA' | 'Other';

// Client type
export type ClientType = 'individual' | 'company';

// Administrator entry
export interface Administrator {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string; // Administrator, Director General, etc.
}

// Contact entry (replaces Shareholder)
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string; // Contabil, Secretar, Manager Proiect, etc.
}

// Company details
export interface CompanyDetails {
  clientType: ClientType;
  cui?: string; // Romanian tax ID (CUI/CIF)
  registrationNumber?: string; // J number (e.g., J40/1234/2020)
  companyType?: CompanyType;
  administrators: Administrator[];
  contacts: Contact[];
}

interface CompanyDetailsFormProps {
  value: CompanyDetails;
  onChange: (details: CompanyDetails) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

const companyTypeLabels: Record<CompanyType, string> = {
  SRL: 'SRL - Societate cu Răspundere Limitată',
  SA: 'SA - Societate pe Acțiuni',
  PFA: 'PFA - Persoană Fizică Autorizată',
  II: 'II - Întreprindere Individuală',
  IF: 'IF - Întreprindere Familială',
  SNC: 'SNC - Societate în Nume Colectiv',
  SCS: 'SCS - Societate în Comandită Simplă',
  SCA: 'SCA - Societate în Comandită pe Acțiuni',
  Other: 'Altele',
};

/**
 * CompanyDetailsForm component
 * Form for collecting company-specific client data (CUI, registration, administrators, contacts)
 */
export function CompanyDetailsForm({
  value,
  onChange,
  errors = {},
  disabled = false,
  className,
}: CompanyDetailsFormProps) {
  // Show company fields only when clientType is 'company'
  const showCompanyFields = value.clientType === 'company';

  // Update a field
  const updateField = <K extends keyof CompanyDetails>(field: K, fieldValue: CompanyDetails[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Client Type Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-linear-text-secondary">Tip client</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(
              'flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
              value.clientType === 'individual'
                ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                : 'border-linear-border-subtle bg-linear-bg-secondary text-linear-text-tertiary hover:bg-linear-bg-tertiary'
            )}
            onClick={() => updateField('clientType', 'individual')}
            disabled={disabled}
          >
            Persoană Fizică
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
              value.clientType === 'company'
                ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                : 'border-linear-border-subtle bg-linear-bg-secondary text-linear-text-tertiary hover:bg-linear-bg-tertiary'
            )}
            onClick={() => updateField('clientType', 'company')}
            disabled={disabled}
          >
            Persoană Juridică
          </button>
        </div>
      </div>

      {/* Company-specific fields */}
      {showCompanyFields && (
        <>
          {/* Company Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-linear-text-secondary">Forma juridică</label>
            <Select
              value={value.companyType || ''}
              onValueChange={(v) => updateField('companyType', v as CompanyType)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selectează forma juridică" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(companyTypeLabels).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.companyType && (
              <p className="text-sm text-linear-error">{errors.companyType}</p>
            )}
          </div>

          {/* CUI / Tax ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-linear-text-secondary">
              CUI / Cod Fiscal
            </label>
            <Input
              value={value.cui || ''}
              onChange={(e) => updateField('cui', e.target.value)}
              placeholder="e.g., RO12345678"
              disabled={disabled}
              className={cn(errors.cui && 'border-linear-error')}
            />
            {errors.cui ? (
              <p className="text-sm text-linear-error">{errors.cui}</p>
            ) : (
              <p className="text-xs text-linear-text-muted">
                8-10 cifre, opțional prefixat cu RO pentru TVA
              </p>
            )}
          </div>

          {/* Registration Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-linear-text-secondary">
              Număr Registru Comerț
            </label>
            <Input
              value={value.registrationNumber || ''}
              onChange={(e) => updateField('registrationNumber', e.target.value)}
              placeholder="e.g., J40/1234/2020"
              disabled={disabled}
              className={cn(errors.registrationNumber && 'border-linear-error')}
            />
            {errors.registrationNumber && (
              <p className="text-sm text-linear-error">{errors.registrationNumber}</p>
            )}
          </div>

          {/* Administrators Section */}
          <AdministratorsSection
            administrators={value.administrators}
            onChange={(admins) => updateField('administrators', admins)}
            disabled={disabled}
            errors={errors}
          />

          {/* Contacts Section */}
          <ContactsSection
            contacts={value.contacts}
            onChange={(contacts) => updateField('contacts', contacts)}
            disabled={disabled}
            errors={errors}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Administrators Section
// ============================================================================

interface AdministratorsSectionProps {
  administrators: Administrator[];
  onChange: (administrators: Administrator[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

function AdministratorsSection({
  administrators,
  onChange,
  disabled,
  errors,
}: AdministratorsSectionProps) {
  const addAdministrator = () => {
    const newAdmin: Administrator = {
      id: crypto.randomUUID(),
      name: '',
      role: 'Administrator',
    };
    onChange([...administrators, newAdmin]);
  };

  const updateAdministrator = (id: string, field: keyof Administrator, value: string) => {
    onChange(
      administrators.map((admin) => (admin.id === id ? { ...admin, [field]: value } : admin))
    );
  };

  const removeAdministrator = (id: string) => {
    onChange(administrators.filter((admin) => admin.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-linear-text-secondary">Administratori</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addAdministrator}
          disabled={disabled}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adaugă
        </Button>
      </div>

      {administrators.length === 0 ? (
        <p className="text-sm text-linear-text-muted py-2">Nu există administratori adăugați</p>
      ) : (
        <div className="space-y-3">
          {administrators.map((admin, index) => (
            <div
              key={admin.id}
              className="flex items-start gap-3 p-3 bg-linear-bg-tertiary rounded-lg"
            >
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Input
                  value={admin.name}
                  onChange={(e) => updateAdministrator(admin.id, 'name', e.target.value)}
                  placeholder="Nume complet"
                  disabled={disabled}
                  className={cn(errors?.[`admin_${index}_name`] && 'border-linear-error')}
                />
                <Input
                  value={admin.role}
                  onChange={(e) => updateAdministrator(admin.id, 'role', e.target.value)}
                  placeholder="Funcție (ex: Administrator)"
                  disabled={disabled}
                />
                <Input
                  type="email"
                  value={admin.email || ''}
                  onChange={(e) => updateAdministrator(admin.id, 'email', e.target.value)}
                  placeholder="Email"
                  disabled={disabled}
                />
                <Input
                  type="tel"
                  value={admin.phone || ''}
                  onChange={(e) => updateAdministrator(admin.id, 'phone', e.target.value)}
                  placeholder="Telefon"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-linear-text-tertiary hover:text-linear-error"
                onClick={() => removeAdministrator(admin.id)}
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Contacts Section
// ============================================================================

interface ContactsSectionProps {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

function ContactsSection({ contacts, onChange, disabled, errors }: ContactsSectionProps) {
  const addContact = () => {
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
    };
    onChange([...contacts, newContact]);
  };

  const updateContact = (id: string, field: keyof Contact, value: string) => {
    onChange(
      contacts.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact))
    );
  };

  const removeContact = (id: string) => {
    onChange(contacts.filter((contact) => contact.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-linear-text-secondary">
          Persoane de contact
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={addContact} disabled={disabled}>
          <Plus className="w-4 h-4 mr-1" />
          Adaugă
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-linear-text-muted py-2">
          Nu există persoane de contact adăugate
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact, index) => (
            <div
              key={contact.id}
              className="flex items-start gap-3 p-3 bg-linear-bg-tertiary rounded-lg"
            >
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Input
                  value={contact.name}
                  onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                  placeholder="Nume complet"
                  disabled={disabled}
                  className={cn(errors?.[`contact_${index}_name`] && 'border-linear-error')}
                />
                <Input
                  value={contact.role}
                  onChange={(e) => updateContact(contact.id, 'role', e.target.value)}
                  placeholder="Rol (ex: Contabil, Secretar)"
                  disabled={disabled}
                />
                <Input
                  type="email"
                  value={contact.email || ''}
                  onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                  placeholder="Email"
                  disabled={disabled}
                />
                <Input
                  type="tel"
                  value={contact.phone || ''}
                  onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                  placeholder="Telefon"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-linear-text-tertiary hover:text-linear-error"
                onClick={() => removeContact(contact.id)}
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate CUI format
 * Romanian CUI: 2-10 digits, optionally prefixed with RO
 */
export function validateCUI(cui: string): boolean {
  const cleaned = cui.replace(/^RO/i, '').trim();
  return /^\d{2,10}$/.test(cleaned);
}

/**
 * Validate registration number format
 * Format: J{county}/{number}/{year} e.g., J40/1234/2020
 */
export function validateRegistrationNumber(regNumber: string): boolean {
  return /^J\d{1,2}\/\d+\/\d{4}$/.test(regNumber);
}

/**
 * Validate company details
 */
export function validateCompanyDetails(details: CompanyDetails): Record<string, string> {
  const errors: Record<string, string> = {};

  if (details.clientType !== 'company') {
    return errors;
  }

  if (details.cui && !validateCUI(details.cui)) {
    errors.cui = 'CUI invalid. Format: 8-10 cifre, opțional prefixat cu RO';
  }

  if (details.registrationNumber && !validateRegistrationNumber(details.registrationNumber)) {
    errors.registrationNumber = 'Format invalid. Exemplu: J40/1234/2020';
  }

  // Validate administrators
  details.administrators.forEach((admin, index) => {
    if (!admin.name.trim()) {
      errors[`admin_${index}_name`] = 'Numele este obligatoriu';
    }
  });

  // Validate contacts
  details.contacts.forEach((contact, index) => {
    if (!contact.name.trim()) {
      errors[`contact_${index}_name`] = 'Numele este obligatoriu';
    }
  });

  return errors;
}
