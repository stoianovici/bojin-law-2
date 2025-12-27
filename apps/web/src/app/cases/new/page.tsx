'use client';

/**
 * New Case Page
 * OPS-216: Draft Mode New Case Page
 *
 * Renders workspace in draft mode with progressive tab visibility.
 * Uses useDraftCase for local state management before saving to server.
 */

import { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftCase, type DraftActor, type DraftBilling } from '@/hooks/useDraftCase';
import { CaseTypeCombobox } from '@/components/case/CaseTypeCombobox';
import { useActorTypes } from '@/hooks/useActorTypes';
import { DraftModeToolbar } from '@/components/case/DraftModeToolbar';
import { FinancialData } from '@/components/auth/FinancialData';
import type { CaseActorRole, BillingType } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DraftFieldProps {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

interface DraftActorCardProps {
  actor: DraftActor;
  onUpdate: (updates: Partial<Omit<DraftActor, 'tempId'>>) => void;
  onRemove: () => void;
  isFirst?: boolean;
  actorTypeOptions: { value: string; label: string; isBuiltIn: boolean }[];
  isPartner?: boolean;
  onCreateActorType?: (name: string, code: string) => Promise<{ success: boolean; error?: string }>;
  createLoading?: boolean;
}

// ============================================================================
// Card Component
// ============================================================================

interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function Card({ title, children, action, className }: CardProps) {
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================================================
// Draft Field Component
// ============================================================================

function DraftField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  options,
  error,
  required,
  disabled,
}: DraftFieldProps) {
  const displayValue = value?.toString() || '';

  const baseInputClasses = clsx(
    'w-full px-3 py-2 border rounded-md text-gray-900 focus:outline-none focus:ring-2',
    error
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
    disabled && 'bg-gray-50 cursor-not-allowed'
  );

  return (
    <div className="py-3 border-b border-gray-200 last:border-0">
      <label className="block text-sm font-medium text-gray-500 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {type === 'textarea' ? (
        <textarea
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={baseInputClasses}
        />
      ) : type === 'select' && options ? (
        <select
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClasses}
        >
          <option value="">Selectează...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={baseInputClasses}
        />
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================================
// Draft Actor Card Component
// ============================================================================

// OPS-223: Updated to use dynamic actor types from useActorTypes hook

function DraftActorCard({
  actor,
  onUpdate,
  onRemove,
  isFirst,
  actorTypeOptions,
  isPartner,
  onCreateActorType,
  createLoading,
}: DraftActorCardProps) {
  const [showAddActorType, setShowAddActorType] = useState(false);
  const [newActorTypeName, setNewActorTypeName] = useState('');
  const [newActorTypeCode, setNewActorTypeCode] = useState('');

  // Helper to generate code from name
  const generateCodeFromName = (name: string) =>
    name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

  const handleActorTypeNameChange = (name: string) => {
    setNewActorTypeName(name);
    if (name) {
      setNewActorTypeCode(generateCodeFromName(name));
    }
  };

  const handleCreateActorType = async () => {
    if (!newActorTypeName.trim() || !newActorTypeCode.trim() || !onCreateActorType) return;

    const result = await onCreateActorType(newActorTypeName.trim(), newActorTypeCode.trim());
    if (result.success) {
      // Auto-select the new type (custom types use customRoleCode)
      onUpdate({ role: 'Other', customRoleCode: newActorTypeCode.trim() });
      setShowAddActorType(false);
      setNewActorTypeName('');
      setNewActorTypeCode('');
    }
  };

  // Handle role selection - determine if built-in or custom
  const handleRoleChange = (value: string) => {
    const selectedOption = actorTypeOptions.find((opt) => opt.value === value);
    if (selectedOption?.isBuiltIn) {
      // Built-in type: use role enum, clear customRoleCode
      onUpdate({ role: value as CaseActorRole, customRoleCode: undefined });
    } else {
      // Custom type: use 'Other' enum, set customRoleCode
      onUpdate({ role: 'Other', customRoleCode: value });
    }
  };

  // Current selected value (customRoleCode if set, otherwise role)
  const currentValue = actor.customRoleCode || actor.role;

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <select
            value={currentValue}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1"
          >
            {actorTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isPartner && onCreateActorType && (
            <button
              type="button"
              onClick={() => setShowAddActorType(!showAddActorType)}
              className="px-2 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
            >
              + Tip
            </button>
          )}
        </div>
        {!isFirst && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            title="Șterge"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Add New Actor Type Form */}
      {showAddActorType && isPartner && (
        <div className="p-3 bg-white border border-gray-200 rounded-md space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nume tip nou</label>
              <input
                type="text"
                value={newActorTypeName}
                onChange={(e) => handleActorTypeNameChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex: Mediator"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cod (auto)</label>
              <input
                type="text"
                value={newActorTypeCode}
                onChange={(e) =>
                  setNewActorTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                placeholder="MEDIATOR"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddActorType(false);
                setNewActorTypeName('');
                setNewActorTypeCode('');
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Anulează
            </button>
            <button
              type="button"
              disabled={!newActorTypeName.trim() || !newActorTypeCode.trim() || createLoading}
              onClick={handleCreateActorType}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {createLoading && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              Salvează
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Nume <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={actor.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Nume complet"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Organizație</label>
          <input
            type="text"
            value={actor.organization || ''}
            onChange={(e) => onUpdate({ organization: e.target.value })}
            placeholder="Companie / Instituție"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input
            type="email"
            value={actor.email || ''}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="email@exemplu.ro"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
          <input
            type="tel"
            value={actor.phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="+40 7XX XXX XXX"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Draft Billing Section Component
// ============================================================================

interface DraftBillingSectionProps {
  billing: DraftBilling;
  onUpdate: (updates: Partial<DraftBilling>) => void;
  error?: string;
}

function DraftBillingSection({ billing, onUpdate, error }: DraftBillingSectionProps) {
  return (
    <Card title="Facturare">
      <div className="space-y-4">
        {/* Billing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">Tip facturare</label>
          <select
            value={billing.type}
            onChange={(e) => onUpdate({ type: e.target.value as BillingType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="Hourly">Pe oră</option>
            <option value="Fixed">Sumă fixă</option>
          </select>
        </div>

        {/* Fixed Amount (when type=Fixed) */}
        {billing.type === 'Fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">
              Sumă fixă (RON) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={billing.fixedAmount || ''}
              onChange={(e) =>
                onUpdate({
                  fixedAmount: e.target.value ? parseFloat(e.target.value) * 100 : undefined,
                })
              }
              placeholder="ex: 5000"
              min="0"
              step="100"
              className={clsx(
                'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2',
                error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              )}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            <p className="mt-1 text-xs text-gray-500">Suma totală pentru dosar (în RON)</p>
          </div>
        )}

        {/* Custom Rates (when type=Hourly) */}
        {billing.type === 'Hourly' && (
          <div className="pt-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Rate orare personalizate (opțional)
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Partner (RON/h)
                </label>
                <input
                  type="number"
                  value={billing.customRates?.partnerRate || ''}
                  onChange={(e) =>
                    onUpdate({
                      customRates: {
                        ...billing.customRates,
                        partnerRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="Standard"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Asociat (RON/h)
                </label>
                <input
                  type="number"
                  value={billing.customRates?.associateRate || ''}
                  onChange={(e) =>
                    onUpdate({
                      customRates: {
                        ...billing.customRates,
                        associateRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="Standard"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Paralegal (RON/h)
                </label>
                <input
                  type="number"
                  value={billing.customRates?.paralegalRate || ''}
                  onChange={(e) =>
                    onUpdate({
                      customRates: {
                        ...billing.customRates,
                        paralegalRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="Standard"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Lăsați gol pentru a folosi ratele standard ale firmei
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function NewCasePage() {
  const router = useRouter();
  const { user } = useAuth();
  // OPS-223: Fetch dynamic actor types
  const { actorTypeOptions, createActorType, createLoading: createActorLoading } = useActorTypes();

  const isAssociate = user?.role === 'Associate';
  const isPartner = user?.role === 'Partner';

  // Draft case state
  const {
    draft,
    updateField,
    addActor,
    updateActor,
    removeActor,
    updateBilling,
    save,
    isDirty,
    isSaving,
    isValid,
    validationErrors,
  } = useDraftCase();

  // Convert validation errors to array for toolbar
  const errorMessages = useMemo(() => {
    return Object.values(validationErrors);
  }, [validationErrors]);

  // Handle save
  const handleSave = useCallback(async () => {
    const result = await save();
    if (result.success && result.case) {
      router.push(`/cases/${result.case.id}`);
    }
  }, [save, router]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push('/cases');
  }, [router]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'Aveți modificări nesalvate. Sigur doriți să părăsiți pagina?'
      );
      if (!confirmed) return;
    }
    router.push('/cases');
  }, [isDirty, router]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Înapoi"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderPlus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {draft.title || 'Dosar Nou'}
                </h1>
                <p className="text-sm text-gray-500">
                  Ciornă - completați detaliile pentru a crea dosarul
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ================================================================ */}
          {/* Case Details Section                                           */}
          {/* ================================================================ */}
          <Card title="Detalii Dosar">
            <div className="divide-y divide-gray-200">
              <DraftField
                label="Titlu"
                value={draft.title}
                onChange={(value) => updateField('title', value)}
                placeholder="Titlul dosarului"
                error={validationErrors.title}
                required
              />

              <DraftField
                label="Nr. Dosar Instanță"
                value={draft.caseNumber}
                onChange={(value) => updateField('caseNumber', value)}
                placeholder="ex: 1234/5/2024"
              />

              <DraftField
                label="Descriere"
                value={draft.description}
                onChange={(value) => updateField('description', value)}
                placeholder="Descrierea pe scurt a dosarului..."
                type="textarea"
                error={validationErrors.description}
              />

              {/* Case Type with searchable combobox */}
              <div className="py-3 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Tip dosar <span className="text-red-500">*</span>
                </label>
                <CaseTypeCombobox
                  value={draft.type || null}
                  onChange={(typeCode) => updateField('type', typeCode)}
                  required
                  canCreate={isPartner}
                  error={validationErrors.type}
                />
              </div>

              <DraftField
                label="Nume client"
                value={draft.clientName}
                onChange={(value) => updateField('clientName', value)}
                placeholder="Numele sau denumirea clientului"
                error={validationErrors.clientName}
                required
              />

              <DraftField
                label="Valoare dosar (RON)"
                value={draft.value}
                onChange={(value) => updateField('value', value ? parseFloat(value) : undefined)}
                placeholder="Opțional"
                type="number"
              />
            </div>
          </Card>

          {/* ================================================================ */}
          {/* Contacts Section                                                */}
          {/* ================================================================ */}
          <Card
            title="Contacte & Părți"
            action={
              <button
                type="button"
                onClick={() => addActor('Client')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Adaugă
              </button>
            }
          >
            <div className="space-y-3">
              {validationErrors.actors && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {validationErrors.actors}
                </p>
              )}

              {draft.actors.map((actor, index) => (
                <DraftActorCard
                  key={actor.tempId}
                  actor={actor}
                  onUpdate={(updates) => updateActor(actor.tempId, updates)}
                  onRemove={() => removeActor(actor.tempId)}
                  isFirst={index === 0}
                  actorTypeOptions={actorTypeOptions}
                  isPartner={isPartner}
                  onCreateActorType={createActorType}
                  createLoading={createActorLoading}
                />
              ))}

              {draft.actors.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nu au fost adăugate persoane de contact.
                </p>
              )}
            </div>
          </Card>

          {/* ================================================================ */}
          {/* Billing Section (Partners only)                                 */}
          {/* ================================================================ */}
          {isPartner && (
            <div className="lg:col-span-2">
              <FinancialData>
                <DraftBillingSection
                  billing={draft.billing}
                  onUpdate={updateBilling}
                  error={validationErrors.fixedAmount}
                />
              </FinancialData>
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Toolbar */}
      <DraftModeToolbar
        onSave={handleSave}
        onCancel={handleCancel}
        isDirty={isDirty}
        isValid={isValid}
        isSaving={isSaving}
        validationErrors={errorMessages}
        showApprovalNotice={isAssociate}
        saveButtonText="Creează Dosar"
      />
    </div>
  );
}
