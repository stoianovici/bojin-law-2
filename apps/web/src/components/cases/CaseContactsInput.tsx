'use client';

import { Plus, Trash2, Mail, User, Tag } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

// Role suggestions based on CaseActorRole enum with Romanian labels
const ROLE_SUGGESTIONS = [
  { value: 'Client', label: 'Client' },
  { value: 'OpposingParty', label: 'Parte Adversă' },
  { value: 'OpposingCounsel', label: 'Avocat Parte Adversă' },
  { value: 'Witness', label: 'Martor' },
  { value: 'Expert', label: 'Expert' },
  { value: 'Intervenient', label: 'Intervenient' },
  { value: 'Mandatar', label: 'Mandatar' },
  { value: 'Court', label: 'Instanță' },
  { value: 'Prosecutor', label: 'Procuror' },
  { value: 'Bailiff', label: 'Executor Judecătoresc' },
  { value: 'Notary', label: 'Notar' },
  { value: 'LegalRepresentative', label: 'Reprezentant Legal' },
];

export interface CaseContact {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface CaseContactsInputProps {
  value: CaseContact[];
  onChange: (contacts: CaseContact[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  className?: string;
}

export function CaseContactsInput({
  value,
  onChange,
  disabled = false,
  errors = {},
  className,
}: CaseContactsInputProps) {
  const addContact = () => {
    const newContact: CaseContact = {
      id: crypto.randomUUID(),
      email: '',
      name: '',
      role: '',
    };
    onChange([...value, newContact]);
  };

  const updateContact = (id: string, field: keyof CaseContact, fieldValue: string) => {
    onChange(
      value.map((contact) => (contact.id === id ? { ...contact, [field]: fieldValue } : contact))
    );
  };

  const removeContact = (id: string) => {
    onChange(value.filter((contact) => contact.id !== id));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-linear-text-secondary">
          Contacte pentru sincronizare email
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={addContact} disabled={disabled}>
          <Plus className="w-4 h-4 mr-1" />
          Adaugă
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-linear-text-muted py-2">
          Nu există contacte adăugate. Adăugați adrese email pentru sincronizare automată.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((contact, index) => (
            <div
              key={contact.id}
              className="flex items-start gap-3 p-3 bg-linear-bg-tertiary rounded-lg"
            >
              <div className="flex-1 space-y-3">
                {/* Email - required */}
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-linear-text-tertiary shrink-0" />
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                    placeholder="Email (obligatoriu)"
                    disabled={disabled}
                    className={cn(
                      'flex-1',
                      errors?.[`contact_${index}_email`] && 'border-linear-error'
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Name - optional */}
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-linear-text-tertiary shrink-0" />
                    <Input
                      value={contact.name || ''}
                      onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                      placeholder="Nume (opțional)"
                      disabled={disabled}
                      className="flex-1"
                    />
                  </div>

                  {/* Role - optional with suggestions */}
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-linear-text-tertiary shrink-0" />
                    <div className="flex-1 relative">
                      <Input
                        value={contact.role || ''}
                        onChange={(e) => updateContact(contact.id, 'role', e.target.value)}
                        placeholder="Rol (opțional)"
                        disabled={disabled}
                        list={`role-suggestions-${contact.id}`}
                        className="flex-1"
                      />
                      <datalist id={`role-suggestions-${contact.id}`}>
                        {ROLE_SUGGESTIONS.map((suggestion) => (
                          <option key={suggestion.value} value={suggestion.value}>
                            {suggestion.label}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {errors?.[`contact_${index}_email`] && (
                  <p className="text-xs text-linear-error">{errors[`contact_${index}_email`]}</p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-linear-text-tertiary hover:text-linear-error shrink-0"
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

/**
 * Validate case contacts
 */
export function validateCaseContacts(contacts: CaseContact[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seenEmails = new Set<string>();

  contacts.forEach((contact, index) => {
    const email = contact.email.trim().toLowerCase();

    // Email is required
    if (!email) {
      errors[`contact_${index}_email`] = 'Email-ul este obligatoriu';
    } else if (!isValidEmail(email)) {
      errors[`contact_${index}_email`] = 'Format email invalid';
    } else if (seenEmails.has(email)) {
      errors[`contact_${index}_email`] = 'Email duplicat';
    } else {
      seenEmails.add(email);
    }
  });

  return errors;
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
