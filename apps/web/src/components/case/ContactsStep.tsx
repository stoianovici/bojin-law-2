/**
 * Contacts Step Component
 * OPS-038: Contacts & Metadata in Case Flow
 *
 * Step 2 of the new case creation wizard - collect contacts and optional metadata
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import type { CaseActorRole } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface ContactData {
  role: CaseActorRole;
  name: string;
  organization?: string;
  email?: string;
  emailDomains: string[];
  phone?: string;
}

export interface ContactsStepData {
  contacts: ContactData[];
  referenceNumbers: string[];
}

export interface ContactsStepProps {
  data: ContactsStepData;
  onChange: (data: ContactsStepData) => void;
  errors?: {
    contacts?: string;
    client?: string;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

interface ContactCardProps {
  contact: ContactData;
  index: number;
  onUpdate: (index: number, contact: ContactData) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}

function ContactCard({ contact, index, onUpdate, onRemove, showRemove }: ContactCardProps) {
  const [showEmailDomains, setShowEmailDomains] = useState(false);
  const [newEmailDomain, setNewEmailDomain] = useState('');

  const handleFieldChange = (field: keyof ContactData, value: string) => {
    onUpdate(index, { ...contact, [field]: value });
  };

  const handleAddEmailDomain = () => {
    const trimmed = newEmailDomain.trim();
    if (trimmed && !contact.emailDomains.includes(trimmed)) {
      onUpdate(index, {
        ...contact,
        emailDomains: [...contact.emailDomains, trimmed],
      });
      setNewEmailDomain('');
    }
  };

  const handleRemoveEmailDomain = (emailIndex: number) => {
    onUpdate(index, {
      ...contact,
      emailDomains: contact.emailDomains.filter((_, i) => i !== emailIndex),
    });
  };

  // OPS-219: Expanded actor roles for Romanian legal practice
  const getRoleBadgeColor = (role: CaseActorRole) => {
    const colorMap: Record<CaseActorRole, string> = {
      Client: 'bg-linear-accent/15 text-linear-accent',
      OpposingParty: 'bg-linear-error/15 text-linear-error',
      OpposingCounsel: 'bg-linear-warning/15 text-linear-warning',
      Witness: 'bg-linear-success/15 text-linear-success',
      Expert: 'bg-purple-500/15 text-purple-500',
      Intervenient: 'bg-cyan-500/15 text-cyan-500',
      Mandatar: 'bg-indigo-500/15 text-indigo-500',
      Court: 'bg-linear-warning/15 text-linear-warning',
      Prosecutor: 'bg-rose-500/15 text-rose-500',
      Bailiff: 'bg-slate-500/15 text-slate-500',
      Notary: 'bg-emerald-500/15 text-emerald-500',
      LegalRepresentative: 'bg-violet-500/15 text-violet-500',
      Other: 'bg-linear-bg-tertiary text-linear-text-secondary',
    };
    return colorMap[role] || 'bg-linear-bg-tertiary text-linear-text-secondary';
  };

  const getRoleLabel = (role: CaseActorRole) => {
    const labels: Record<CaseActorRole, string> = {
      Client: 'Client',
      OpposingParty: 'Parte adversă',
      OpposingCounsel: 'Avocat parte adversă',
      Witness: 'Martor',
      Expert: 'Expert',
      Intervenient: 'Intervenient',
      Mandatar: 'Mandatar',
      Court: 'Instanță',
      Prosecutor: 'Procuror',
      Bailiff: 'Executor Judecătoresc',
      Notary: 'Notar',
      LegalRepresentative: 'Reprezentant Legal',
      Other: 'Altele',
    };
    return labels[role];
  };

  return (
    <div className="p-4 bg-linear-bg-tertiary rounded-lg border border-linear-border-subtle">
      <div className="flex items-start justify-between mb-3">
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(contact.role)}`}
        >
          {getRoleLabel(contact.role)}
          {contact.role === 'Client' && ' *'}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-linear-text-muted hover:text-linear-error transition-colors"
            aria-label="Șterge contact"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-linear-text-secondary mb-1">
            Nume {contact.role === 'Client' && <span className="text-linear-error">*</span>}
          </label>
          <input
            type="text"
            value={contact.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="Nume complet sau denumire"
            className="w-full px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
          />
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-linear-text-secondary mb-1">Organizație</label>
          <input
            type="text"
            value={contact.organization || ''}
            onChange={(e) => handleFieldChange('organization', e.target.value)}
            placeholder="Numele firmei sau organizației"
            className="w-full px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
          />
        </div>

        {/* Email and Phone grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-linear-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={contact.email || ''}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              placeholder="email@exemplu.ro"
              className="w-full px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-linear-text-secondary mb-1">Telefon</label>
            <input
              type="tel"
              value={contact.phone || ''}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              placeholder="+40 721 123 456"
              className="w-full px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
            />
          </div>
        </div>

        {/* Additional Email Domains */}
        <div>
          <button
            type="button"
            onClick={() => setShowEmailDomains(!showEmailDomains)}
            className="text-sm text-linear-accent hover:text-linear-accent flex items-center gap-1"
          >
            <PlusIcon className="h-3 w-3" />
            {showEmailDomains ? 'Ascunde' : 'Adaugă'} adrese email suplimentare
          </button>

          {showEmailDomains && (
            <div className="mt-2 space-y-2">
              {contact.emailDomains.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contact.emailDomains.map((email, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-linear-accent/15 text-linear-accent rounded text-xs"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailDomain(i)}
                        className="hover:text-linear-accent"
                      >
                        <Cross2Icon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmailDomain}
                  onChange={(e) => setNewEmailDomain(e.target.value)}
                  placeholder="alt.email@exemplu.ro"
                  className="flex-1 px-2 py-1 text-sm border border-linear-border rounded focus:outline-none focus:ring-2 focus:ring-linear-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmailDomain();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddEmailDomain}
                  disabled={!newEmailDomain.trim()}
                  className="px-2 py-1 text-xs font-medium text-linear-accent bg-linear-accent/15 border border-linear-accent/30 rounded hover:bg-linear-accent/20 disabled:opacity-50"
                >
                  Adaugă
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContactsStep({ data, onChange, errors }: ContactsStepProps) {
  const [newRefNumber, setNewRefNumber] = useState('');

  // Add a new contact
  const handleAddContact = useCallback(
    (role: CaseActorRole) => {
      onChange({
        ...data,
        contacts: [
          ...data.contacts,
          {
            role,
            name: '',
            emailDomains: [],
          },
        ],
      });
    },
    [data, onChange]
  );

  // Update a contact
  const handleUpdateContact = useCallback(
    (index: number, contact: ContactData) => {
      const newContacts = [...data.contacts];
      newContacts[index] = contact;
      onChange({ ...data, contacts: newContacts });
    },
    [data, onChange]
  );

  // Remove a contact
  const handleRemoveContact = useCallback(
    (index: number) => {
      onChange({
        ...data,
        contacts: data.contacts.filter((_, i) => i !== index),
      });
    },
    [data, onChange]
  );

  // Add reference number
  const handleAddRefNumber = useCallback(() => {
    const trimmed = newRefNumber.trim();
    if (trimmed && !data.referenceNumbers.includes(trimmed)) {
      onChange({
        ...data,
        referenceNumbers: [...data.referenceNumbers, trimmed],
      });
      setNewRefNumber('');
    }
  }, [data, onChange, newRefNumber]);

  // Remove reference number
  const handleRemoveRefNumber = useCallback(
    (index: number) => {
      onChange({
        ...data,
        referenceNumbers: data.referenceNumbers.filter((_, i) => i !== index),
      });
    },
    [data, onChange]
  );

  // Count contacts by role
  const clientCount = data.contacts.filter((c) => c.role === 'Client').length;
  const hasClient = clientCount > 0;

  return (
    <div className="space-y-6">
      {/* Contacts Section */}
      <div>
        <h3 className="text-lg font-medium text-linear-text-primary mb-2">Contacte</h3>
        <p className="text-sm text-linear-text-secondary mb-4">
          Adăugați persoanele de contact relevante pentru acest dosar. Este obligatoriu să aveți cel
          puțin un client.
        </p>

        {/* Error message */}
        {errors?.client && (
          <div className="mb-4 p-3 bg-linear-error/15 border border-linear-error/30 rounded-md">
            <p className="text-sm text-linear-error">{errors.client}</p>
          </div>
        )}

        {/* Contact Cards */}
        <div className="space-y-4 mb-4">
          {data.contacts.map((contact, index) => (
            <ContactCard
              key={index}
              contact={contact}
              index={index}
              onUpdate={handleUpdateContact}
              onRemove={handleRemoveContact}
              showRemove={!(contact.role === 'Client' && clientCount === 1)}
            />
          ))}
        </div>

        {/* Add Contact Buttons */}
        <div className="flex flex-wrap gap-2">
          {!hasClient && (
            <button
              type="button"
              onClick={() => handleAddContact('Client')}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-linear-accent bg-linear-accent/15 border border-linear-accent/30 rounded-md hover:bg-linear-accent/20 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Adaugă client
            </button>
          )}
          <button
            type="button"
            onClick={() => handleAddContact('OpposingParty')}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary border border-linear-border-subtle rounded-md hover:bg-linear-bg-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Parte adversă
          </button>
          <button
            type="button"
            onClick={() => handleAddContact('OpposingCounsel')}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary border border-linear-border-subtle rounded-md hover:bg-linear-bg-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Avocat parte adversă
          </button>
        </div>
      </div>

      {/* Reference Numbers Section */}
      <div className="pt-6 border-t border-linear-border-subtle">
        <h3 className="text-lg font-medium text-linear-text-primary mb-2">Numere dosar instanță</h3>
        <p className="text-sm text-linear-text-secondary mb-4">
          Adăugați numerele de dosar de la instanță (opțional). Acestea ajută la clasificarea
          automată a emailurilor.
        </p>

        {/* Reference Numbers Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {data.referenceNumbers.length === 0 ? (
            <span className="text-sm text-linear-text-muted italic">Niciun număr de dosar adăugat</span>
          ) : (
            data.referenceNumbers.map((refNum, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-linear-bg-tertiary text-linear-text-secondary rounded-md text-sm"
              >
                {refNum}
                <button
                  type="button"
                  onClick={() => handleRemoveRefNumber(index)}
                  className="hover:text-linear-text-primary"
                  aria-label={`Șterge ${refNum}`}
                >
                  <Cross2Icon className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add Reference Number Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newRefNumber}
            onChange={(e) => setNewRefNumber(e.target.value)}
            placeholder="ex: 1234/5/2024"
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddRefNumber();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddRefNumber}
            disabled={!newRefNumber.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary border border-linear-border-subtle rounded-md hover:bg-linear-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-4 w-4" />
            Adaugă
          </button>
        </div>
      </div>
    </div>
  );
}

ContactsStep.displayName = 'ContactsStep';
