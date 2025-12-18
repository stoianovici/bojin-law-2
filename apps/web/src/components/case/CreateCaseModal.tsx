/**
 * Create Case Modal Component
 * Story 2.8: Case CRUD Operations UI - Tasks 6, 7, 8
 * Story 2.8.1: Billing & Rate Management - Task 11
 * Story 2.8.2: Case Approval Workflow - Task 12
 *
 * Modal dialog for creating new cases with form validation and billing setup
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import type { BillingType } from '@legal-platform/types';
import { useCaseCreate } from '../../hooks/useCaseCreate';
import { useDefaultRates } from '../../hooks/useDefaultRates';
import { useCaseTypes } from '../../hooks/useCaseTypes';
import { useClients } from '../../hooks/useClients';
import { useNotificationStore } from '../../stores/notificationStore';
import { FinancialData } from '../auth/FinancialData';
import { useAuth } from '../../contexts/AuthContext';

// Validation schema
const createCaseSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Titlul trebuie să aibă cel puțin 3 caractere')
      .max(500, 'Titlul nu poate depăși 500 de caractere'),
    clientName: z
      .string()
      .min(2, 'Numele clientului trebuie să aibă cel puțin 2 caractere')
      .max(200, 'Numele clientului nu poate depăși 200 de caractere'),
    type: z.string().min(1, 'Vă rugăm selectați tipul dosarului'),
    description: z.string().min(10, 'Descrierea trebuie să aibă cel puțin 10 caractere'),
    value: z.number().positive('Valoarea trebuie să fie pozitivă').optional().nullable(),
    billingType: z.enum(['Hourly', 'Fixed'], {
      required_error: 'Vă rugăm selectați tipul de facturare',
    }),
    fixedAmount: z.number().positive('Suma fixă trebuie să fie pozitivă').optional().nullable(),
    useCustomRates: z.boolean(),
    customPartnerRate: z.number().positive('Tariful trebuie să fie pozitiv').optional().nullable(),
    customAssociateRate: z
      .number()
      .positive('Tariful trebuie să fie pozitiv')
      .optional()
      .nullable(),
    customParalegalRate: z
      .number()
      .positive('Tariful trebuie să fie pozitiv')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // If billing type is Fixed, fixedAmount is required
      if (data.billingType === 'Fixed') {
        return data.fixedAmount != null && data.fixedAmount > 0;
      }
      return true;
    },
    {
      message: 'Suma fixă este obligatorie când tipul de facturare este Fix',
      path: ['fixedAmount'],
    }
  );

type CreateCaseFormData = z.infer<typeof createCaseSchema>;

function centsToLei(cents: number): number {
  return cents / 100;
}

function leiToCents(lei: number): number {
  return Math.round(lei * 100);
}

interface CreateCaseModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateCaseModal({ trigger, onSuccess }: CreateCaseModalProps) {
  const [open, setOpen] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const clientInputRef = useRef<HTMLInputElement | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { createCase, loading } = useCaseCreate();
  const { rates: defaultRates } = useDefaultRates();
  const { caseTypes, loading: caseTypesLoading, createCaseType, createLoading } = useCaseTypes();
  const { clients, loading: clientsLoading, searchClients, clearClients } = useClients();
  const { addNotification } = useNotificationStore();

  // Story 2.8.2: Associates create cases with PendingApproval status
  const isAssociate = user?.role === 'Associate';
  const isPartner = user?.role === 'Partner';

  // Auto-generate code from name
  useEffect(() => {
    if (newTypeName) {
      const generatedCode = newTypeName
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      setNewTypeCode(generatedCode);
    }
  }, [newTypeName]);

  // Close client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(event.target as Node)
      ) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
    setValue,
  } = useForm<CreateCaseFormData>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      title: '',
      clientName: '',
      type: undefined,
      description: '',
      value: null,
      billingType: 'Hourly',
      fixedAmount: null,
      useCustomRates: false,
      customPartnerRate: null,
      customAssociateRate: null,
      customParalegalRate: null,
    },
  });

  // Watch billing type and custom rates toggle
  const billingType = useWatch({ control, name: 'billingType' });
  const useCustomRates = useWatch({ control, name: 'useCustomRates' });

  const handleClose = () => {
    if (isDirty && !confirm('Aveți modificări nesalvate. Sigur doriți să închideți?')) {
      return;
    }
    setOpen(false);
    reset();
    setSelectedClientId(null);
    setShowClientDropdown(false);
    clearClients();
  };

  const onSubmit = async (data: CreateCaseFormData) => {
    try {
      // Build custom rates object if enabled
      const customRates =
        data.useCustomRates &&
        (data.customPartnerRate != null ||
          data.customAssociateRate != null ||
          data.customParalegalRate != null)
          ? {
              partnerRate: data.customPartnerRate ? leiToCents(data.customPartnerRate) : undefined,
              associateRate: data.customAssociateRate
                ? leiToCents(data.customAssociateRate)
                : undefined,
              paralegalRate: data.customParalegalRate
                ? leiToCents(data.customParalegalRate)
                : undefined,
            }
          : undefined;

      // Story 2.8.2: Associates submit for approval, Partners create directly as Active
      const result = await createCase({
        title: data.title,
        clientName: data.clientName,
        type: data.type,
        description: data.description,
        value: data.value ?? undefined,
        billingType: data.billingType as BillingType,
        fixedAmount: data.fixedAmount ? leiToCents(data.fixedAmount) : undefined,
        customRates,
        submitForApproval: isAssociate, // Associates submit for approval, Partners bypass
      });

      if (result.success) {
        // Story 2.8.2: Different success messages based on role
        if (isAssociate) {
          addNotification({
            type: 'success',
            title: 'Dosar trimis pentru aprobare',
            message:
              'Dosarul a fost trimis pentru aprobare. Veți fi notificat când va fi revizuit.',
          });
        } else {
          addNotification({
            type: 'success',
            title: 'Dosar creat',
            message: `Dosarul ${result.case?.caseNumber} a fost creat cu succes.`,
          });
        }
        setOpen(false);
        reset();
        setSelectedClientId(null);
        setShowClientDropdown(false);
        clearClients();
        onSuccess?.();
      } else {
        addNotification({
          type: 'error',
          title: 'Eroare la crearea dosarului',
          message: result.error || 'A apărut o eroare la crearea dosarului.',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'A apărut o eroare neașteptată. Vă rugăm încercați din nou.',
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium">
            + Dosar nou
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />

        <Dialog.Content
          className="fixed z-50 bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-y-auto
            inset-0 md:inset-auto
            md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]
            md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            handleClose();
          }}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-2xl font-bold text-gray-900">
                Creare dosar nou
              </Dialog.Title>
              <Dialog.Close
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </Dialog.Close>
            </div>

            {/* Story 2.8.2: Approval Notice for Associates */}
            {isAssociate && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-blue-800">
                    Acest dosar va fi trimis pentru aprobarea Partenerului înainte de a deveni
                    activ.
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Titlu <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  {...register('title')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Introduceți titlul dosarului"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Client Name with Autocomplete */}
              <div className="relative">
                <label
                  htmlFor="clientName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nume client <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {(() => {
                    const { ref: registerRef, ...registerRest } = register('clientName');
                    return (
                      <input
                        id="clientName"
                        type="text"
                        ref={(e) => {
                          registerRef(e);
                          clientInputRef.current = e;
                        }}
                        {...registerRest}
                        onChange={(e) => {
                          registerRest.onChange(e);
                          const value = e.target.value;
                          searchClients(value);
                          setShowClientDropdown(value.length >= 1);
                          setSelectedClientId(null);
                        }}
                        onFocus={(e) => {
                          if (e.target.value.length >= 1) {
                            searchClients(e.target.value);
                            setShowClientDropdown(true);
                          }
                        }}
                        autoComplete="off"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.clientName ? 'border-red-300' : 'border-gray-300'
                        } ${selectedClientId ? 'bg-blue-50' : ''}`}
                        placeholder="Căutați sau introduceți un client nou"
                      />
                    );
                  })()}
                  {clientsLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
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
                    </div>
                  )}
                  {selectedClientId && !clientsLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg
                        className="h-4 w-4 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Client Autocomplete Dropdown */}
                {showClientDropdown && clients.length > 0 && (
                  <div
                    ref={clientDropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0"
                        onClick={() => {
                          setValue('clientName', client.name, { shouldValidate: true });
                          setSelectedClientId(client.id);
                          setShowClientDropdown(false);
                        }}
                      >
                        <div className="font-medium text-gray-900">{client.name}</div>
                        {client.address && (
                          <div className="text-sm text-gray-500 truncate">{client.address}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedClientId && (
                  <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Client existent selectat
                  </p>
                )}
                {errors.clientName && (
                  <p className="mt-1 text-sm text-red-600">{errors.clientName.message}</p>
                )}
              </div>

              {/* Case Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Tip dosar <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    id="type"
                    {...register('type')}
                    disabled={caseTypesLoading}
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.type ? 'border-red-300' : 'border-gray-300'
                    } ${caseTypesLoading ? 'bg-gray-100' : ''}`}
                  >
                    <option value="">Selectați tipul dosarului</option>
                    {caseTypes.map((ct) => (
                      <option key={ct.id} value={ct.code}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                  {isPartner && (
                    <button
                      type="button"
                      onClick={() => setShowAddType(!showAddType)}
                      className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      title="Adaugă tip nou"
                    >
                      + Tip nou
                    </button>
                  )}
                </div>
                {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}

                {/* Add New Type Form (Partners only) */}
                {showAddType && isPartner && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md space-y-3">
                    <div>
                      <label
                        htmlFor="newTypeName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Nume tip nou
                      </label>
                      <input
                        id="newTypeName"
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ex: Insolvență"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="newTypeCode"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Cod (generat automat)
                      </label>
                      <input
                        id="newTypeCode"
                        type="text"
                        value={newTypeCode}
                        onChange={(e) =>
                          setNewTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                        placeholder="INSOLVENTA"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddType(false);
                          setNewTypeName('');
                          setNewTypeCode('');
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Anulează
                      </button>
                      <button
                        type="button"
                        disabled={!newTypeName || !newTypeCode || createLoading}
                        onClick={async () => {
                          const result = await createCaseType(newTypeName, newTypeCode);
                          if (result.success) {
                            addNotification({
                              type: 'success',
                              title: 'Tip dosar creat',
                              message: `Tipul "${newTypeName}" a fost adăugat cu succes.`,
                            });
                            setShowAddType(false);
                            setNewTypeName('');
                            setNewTypeCode('');
                          } else {
                            addNotification({
                              type: 'error',
                              title: 'Eroare',
                              message: result.error || 'Nu s-a putut crea tipul de dosar.',
                            });
                          }
                        }}
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
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Descriere <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Introduceți descrierea dosarului (minim 10 caractere)"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Value (Partners only - Story 2.8.3) */}
              <FinancialData>
                <div>
                  <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
                    Valoare dosar (Opțional)
                  </label>
                  <input
                    id="value"
                    type="number"
                    step="0.01"
                    {...register('value', { valueAsNumber: true })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.value ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Introduceți valoarea"
                  />
                  {errors.value && (
                    <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>
                  )}
                </div>
              </FinancialData>

              {/* Billing Section (Partners only - Story 2.8.1) */}
              <FinancialData>
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Informații facturare</h3>

                  {/* Billing Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tip facturare <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Hourly"
                          {...register('billingType')}
                          className="mr-2"
                        />
                        <span className="text-sm">Facturare pe oră</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Fixed"
                          {...register('billingType')}
                          className="mr-2"
                        />
                        <span className="text-sm">Sumă fixă</span>
                      </label>
                    </div>
                    {errors.billingType && (
                      <p className="mt-1 text-sm text-red-600">{errors.billingType.message}</p>
                    )}
                  </div>

                  {/* Fixed Amount (shown when Fixed billing type selected) */}
                  {billingType === 'Fixed' && (
                    <div>
                      <label
                        htmlFor="fixedAmount"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Sumă fixă <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          id="fixedAmount"
                          step="0.01"
                          min="0"
                          {...register('fixedAmount', { valueAsNumber: true })}
                          className={`block w-full rounded-md border-gray-300 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                            errors.fixedAmount ? 'border-red-300' : ''
                          }`}
                          placeholder="0.00"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-gray-500 sm:text-sm">RON</span>
                        </div>
                      </div>
                      {errors.fixedAmount && (
                        <p className="mt-1 text-sm text-red-600">{errors.fixedAmount.message}</p>
                      )}
                    </div>
                  )}

                  {/* Default Rates Preview (shown when Hourly billing type selected) */}
                  {billingType === 'Hourly' && !useCustomRates && defaultRates && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Tarife orare implicite:
                      </p>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>
                          Partener: {centsToLei(defaultRates.partnerRate).toFixed(2)} RON/oră
                        </div>
                        <div>
                          Avocat: {centsToLei(defaultRates.associateRate).toFixed(2)} RON/oră
                        </div>
                        <div>
                          Paralegal: {centsToLei(defaultRates.paralegalRate).toFixed(2)} RON/oră
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Rates Toggle */}
                  {billingType === 'Hourly' && (
                    <div>
                      <label className="flex items-center">
                        <input type="checkbox" {...register('useCustomRates')} className="mr-2" />
                        <span className="text-sm text-gray-700">
                          Utilizează tarife personalizate pentru acest dosar
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Custom Rates Inputs */}
                  {billingType === 'Hourly' && useCustomRates && (
                    <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                      <div>
                        <label
                          htmlFor="customPartnerRate"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Tarif Partener
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="customPartnerRate"
                            step="0.01"
                            min="0"
                            {...register('customPartnerRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={
                              defaultRates
                                ? centsToLei(defaultRates.partnerRate).toFixed(2)
                                : '0.00'
                            }
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">RON/oră</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="customAssociateRate"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Tarif Avocat
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="customAssociateRate"
                            step="0.01"
                            min="0"
                            {...register('customAssociateRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={
                              defaultRates
                                ? centsToLei(defaultRates.associateRate).toFixed(2)
                                : '0.00'
                            }
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">RON/oră</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="customParalegalRate"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Tarif Paralegal
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="customParalegalRate"
                            step="0.01"
                            min="0"
                            {...register('customParalegalRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={
                              defaultRates
                                ? centsToLei(defaultRates.paralegalRate).toFixed(2)
                                : '0.00'
                            }
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">RON/oră</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </FinancialData>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && (
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {loading ? 'Se creează...' : 'Creează dosar'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
