/**
 * Edit Case Modal
 * Modal for editing case details - 2-step wizard like CreateCaseModal
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useCaseUpdate } from '../../hooks/useCaseUpdate';
import { useDefaultRates } from '../../hooks/useDefaultRates';
import { useCaseTypes } from '../../hooks/useCaseTypes';
import { useActorAdd } from '../../hooks/useActorAdd';
import { useActorUpdate } from '../../hooks/useActorUpdate';
import { useCaseMetadata } from '../../hooks/useCaseMetadata';
import { useNotificationStore } from '../../stores/notificationStore';
import { FinancialData } from '../auth/FinancialData';
import { useAuth } from '../../contexts/AuthContext';
import { ContactsStep, type ContactsStepData, type ContactData } from './ContactsStep';
import type {
  Case,
  CaseStatus,
  BillingType,
  CaseActor,
  CaseActorRole,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface EditCaseModalProps {
  caseData: Case & { actors?: CaseActor[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'Active', label: 'Activ' },
  { value: 'OnHold', label: 'Suspendat' },
  { value: 'Closed', label: 'Închis' },
  { value: 'Archived', label: 'Arhivat' },
];

// ============================================================================
// Helpers
// ============================================================================

function centsToLei(cents: number): number {
  return cents / 100;
}

function leiToCents(lei: number): number {
  return Math.round(lei * 100);
}

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              i + 1 === currentStep
                ? 'bg-blue-600 text-white'
                : i + 1 < currentStep
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={`w-8 h-0.5 ${i + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function EditCaseModal({ caseData, open, onOpenChange }: EditCaseModalProps) {
  const { updateCase, loading } = useCaseUpdate();
  const { rates: defaultRates } = useDefaultRates();
  const { caseTypes, loading: caseTypesLoading } = useCaseTypes();
  const { addActor, loading: actorAddLoading } = useActorAdd();
  const { updateActor, loading: actorUpdateLoading } = useActorUpdate();
  const { updateMetadata, loading: metadataLoading } = useCaseMetadata();
  const { addNotification } = useNotificationStore();
  useAuth(); // Auth context needed for FinancialData component

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state - Step 1
  const [title, setTitle] = useState(caseData.title);
  const [description, setDescription] = useState(caseData.description || '');
  const [status, setStatus] = useState<CaseStatus>(caseData.status);
  const [type, setType] = useState<string>(caseData.type);
  const [value, setValue] = useState<string>(caseData.value?.toString() || '');

  // Billing state
  const [billingType, setBillingType] = useState<BillingType>(caseData.billingType || 'Hourly');
  const [fixedAmount, setFixedAmount] = useState<string>(
    caseData.fixedAmount ? centsToLei(caseData.fixedAmount).toString() : ''
  );
  const [useCustomRates, setUseCustomRates] = useState(!!caseData.customRates);
  const [customPartnerRate, setCustomPartnerRate] = useState<string>(
    caseData.customRates?.partnerRate ? centsToLei(caseData.customRates.partnerRate).toString() : ''
  );
  const [customAssociateRate, setCustomAssociateRate] = useState<string>(
    caseData.customRates?.associateRate
      ? centsToLei(caseData.customRates.associateRate).toString()
      : ''
  );
  const [customParalegalRate, setCustomParalegalRate] = useState<string>(
    caseData.customRates?.paralegalRate
      ? centsToLei(caseData.customRates.paralegalRate).toString()
      : ''
  );

  // Contacts step state - Step 2
  const initialContactsData = useMemo<ContactsStepData>(() => {
    const actors = caseData.actors || [];
    const contacts: ContactData[] = actors.map((actor) => ({
      role: actor.role as CaseActorRole,
      name: actor.name,
      organization: actor.organization || undefined,
      email: actor.email || undefined,
      emailDomains: (actor as any).emailDomains || [],
      phone: actor.phone || undefined,
    }));

    // Ensure at least one client contact exists
    if (!contacts.some((c) => c.role === 'Client')) {
      contacts.unshift({ role: 'Client', name: '', emailDomains: [] });
    }

    // Get reference numbers from metadata
    const metadata = (caseData as any).metadata || {};
    const referenceNumbers = metadata.referenceNumbers || [];

    return { contacts, referenceNumbers };
  }, [caseData]);

  const [contactsData, setContactsData] = useState<ContactsStepData>(initialContactsData);
  const [contactsErrors, setContactsErrors] = useState<{ client?: string }>({});

  // Reset form when modal opens with new case data
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setTitle(caseData.title);
      setDescription(caseData.description || '');
      setStatus(caseData.status);
      setType(caseData.type);
      setValue(caseData.value?.toString() || '');
      setBillingType(caseData.billingType || 'Hourly');
      setFixedAmount(caseData.fixedAmount ? centsToLei(caseData.fixedAmount).toString() : '');
      setUseCustomRates(!!caseData.customRates);
      setCustomPartnerRate(
        caseData.customRates?.partnerRate
          ? centsToLei(caseData.customRates.partnerRate).toString()
          : ''
      );
      setCustomAssociateRate(
        caseData.customRates?.associateRate
          ? centsToLei(caseData.customRates.associateRate).toString()
          : ''
      );
      setCustomParalegalRate(
        caseData.customRates?.paralegalRate
          ? centsToLei(caseData.customRates.paralegalRate).toString()
          : ''
      );
      setContactsData(initialContactsData);
      setContactsErrors({});
    }
  }, [open, caseData, initialContactsData]);

  // Validate contacts step before proceeding
  const validateContactsStep = (): boolean => {
    const clientContacts = contactsData.contacts.filter((c) => c.role === 'Client');
    if (clientContacts.length === 0) {
      setContactsErrors({ client: 'Este necesar cel puțin un contact de tip Client.' });
      return false;
    }
    const hasClientWithName = clientContacts.some((c) => c.name.trim().length > 0);
    if (!hasClientWithName) {
      setContactsErrors({ client: 'Clientul trebuie să aibă un nume.' });
      return false;
    }
    setContactsErrors({});
    return true;
  };

  // Handle step navigation
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!title.trim()) {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Titlul cazului este obligatoriu.',
        });
        return;
      }
      if (billingType === 'Fixed' && !fixedAmount) {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Suma fixă este obligatorie când tipul de facturare este Fix.',
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateContactsStep()) {
        handleSubmit();
      }
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(Math.max(1, currentStep - 1));
  };

  const handleSubmit = async () => {
    try {
      // Build custom rates object if enabled
      const customRates =
        useCustomRates && (customPartnerRate || customAssociateRate || customParalegalRate)
          ? {
              partnerRate: customPartnerRate
                ? leiToCents(parseFloat(customPartnerRate))
                : undefined,
              associateRate: customAssociateRate
                ? leiToCents(parseFloat(customAssociateRate))
                : undefined,
              paralegalRate: customParalegalRate
                ? leiToCents(parseFloat(customParalegalRate))
                : undefined,
            }
          : null;

      // Update case details
      await updateCase(caseData.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        type,
        value: value ? parseFloat(value) : undefined,
        billingType,
        fixedAmount: fixedAmount ? leiToCents(parseFloat(fixedAmount)) : null,
        customRates,
      });

      // Update or add actors
      const existingActors = caseData.actors || [];
      for (const contact of contactsData.contacts) {
        if (contact.name.trim()) {
          // Find matching existing actor by role and name
          const existingActor = existingActors.find(
            (a) => a.role === contact.role && a.name === contact.name
          );

          if (existingActor) {
            // Update existing actor
            await updateActor(existingActor.id, {
              name: contact.name.trim(),
              organization: contact.organization?.trim() || undefined,
              email: contact.email?.trim() || undefined,
              emailDomains: contact.emailDomains.length > 0 ? contact.emailDomains : undefined,
              phone: contact.phone?.trim() || undefined,
            });
          } else {
            // Add new actor
            await addActor({
              caseId: caseData.id,
              role: contact.role,
              name: contact.name.trim(),
              organization: contact.organization?.trim() || undefined,
              email: contact.email?.trim() || undefined,
              emailDomains: contact.emailDomains.length > 0 ? contact.emailDomains : undefined,
              phone: contact.phone?.trim() || undefined,
            });
          }
        }
      }

      // Update reference numbers if changed
      const originalRefNumbers = ((caseData as any).metadata?.referenceNumbers || []) as string[];
      const newRefNumbers = contactsData.referenceNumbers;
      if (JSON.stringify(originalRefNumbers) !== JSON.stringify(newRefNumbers)) {
        await updateMetadata(caseData.id, {
          referenceNumbers: newRefNumbers,
        });
      }

      addNotification({
        type: 'success',
        title: 'Salvat',
        message: 'Dosarul a fost actualizat cu succes.',
      });

      onOpenChange(false);
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut actualiza dosarul. Vă rugăm încercați din nou.',
      });
    }
  };

  const isLoading = loading || actorAddLoading || actorUpdateLoading || metadataLoading;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed z-50 bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-y-auto inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-2xl font-bold text-gray-900">
                Editează dosarul
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1">
                <Cross2Icon className="h-6 w-6" />
              </Dialog.Close>
            </div>

            {/* Step Indicator */}
            <StepIndicator currentStep={currentStep} totalSteps={2} />

            {/* Step Titles */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-700">
                {currentStep === 1 ? 'Informații dosar' : 'Contacte și clasificare'}
              </h3>
              <p className="text-sm text-gray-500">
                {currentStep === 1
                  ? 'Modificați detaliile de bază ale dosarului'
                  : 'Gestionați persoanele de contact și referințele'}
              </p>
            </div>

            {/* Step 2: Contacts */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <ContactsStep
                  data={contactsData}
                  onChange={setContactsData}
                  errors={contactsErrors}
                />

                {/* Step 2 Navigation Buttons */}
                <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                  >
                    Înapoi
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading && (
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
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
                    {isLoading ? 'Se salvează...' : 'Salvează'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Form */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label
                    htmlFor="edit-title"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Titlu <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Introduceți titlul dosarului"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Case Type */}
                <div>
                  <label
                    htmlFor="edit-type"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Tip dosar <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={isLoading || caseTypesLoading}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      caseTypesLoading ? 'bg-gray-100' : ''
                    }`}
                  >
                    {caseTypes.map((ct) => (
                      <option key={ct.id} value={ct.code}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="edit-description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Descriere
                  </label>
                  <textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrierea dosarului"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={isLoading}
                  />
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="edit-status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CaseStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value (Partners only) */}
                <FinancialData>
                  <div>
                    <label
                      htmlFor="edit-value"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Valoare dosar (Opțional)
                    </label>
                    <input
                      id="edit-value"
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Introduceți valoarea"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                  </div>
                </FinancialData>

                {/* Billing Section (Partners only) */}
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
                            name="billingType"
                            value="Hourly"
                            checked={billingType === 'Hourly'}
                            onChange={() => setBillingType('Hourly')}
                            className="mr-2"
                            disabled={isLoading}
                          />
                          <span className="text-sm">Facturare pe oră</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="billingType"
                            value="Fixed"
                            checked={billingType === 'Fixed'}
                            onChange={() => setBillingType('Fixed')}
                            className="mr-2"
                            disabled={isLoading}
                          />
                          <span className="text-sm">Sumă fixă</span>
                        </label>
                      </div>
                    </div>

                    {/* Fixed Amount */}
                    {billingType === 'Fixed' && (
                      <div>
                        <label
                          htmlFor="edit-fixedAmount"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Sumă fixă <span className="text-red-500">*</span>
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            id="edit-fixedAmount"
                            step="0.01"
                            min="0"
                            value={fixedAmount}
                            onChange={(e) => setFixedAmount(e.target.value)}
                            className="block w-full rounded-md border-gray-300 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="0.00"
                            disabled={isLoading}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">RON</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Default Rates Preview */}
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
                          <input
                            type="checkbox"
                            checked={useCustomRates}
                            onChange={(e) => setUseCustomRates(e.target.checked)}
                            className="mr-2"
                            disabled={isLoading}
                          />
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
                            htmlFor="edit-customPartnerRate"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Tarif Partener
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id="edit-customPartnerRate"
                              step="0.01"
                              min="0"
                              value={customPartnerRate}
                              onChange={(e) => setCustomPartnerRate(e.target.value)}
                              className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              placeholder={
                                defaultRates
                                  ? centsToLei(defaultRates.partnerRate).toFixed(2)
                                  : '0.00'
                              }
                              disabled={isLoading}
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <span className="text-gray-500 sm:text-sm">RON/oră</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="edit-customAssociateRate"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Tarif Avocat
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id="edit-customAssociateRate"
                              step="0.01"
                              min="0"
                              value={customAssociateRate}
                              onChange={(e) => setCustomAssociateRate(e.target.value)}
                              className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              placeholder={
                                defaultRates
                                  ? centsToLei(defaultRates.associateRate).toFixed(2)
                                  : '0.00'
                              }
                              disabled={isLoading}
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <span className="text-gray-500 sm:text-sm">RON/oră</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="edit-customParalegalRate"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Tarif Paralegal
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id="edit-customParalegalRate"
                              step="0.01"
                              min="0"
                              value={customParalegalRate}
                              onChange={(e) => setCustomParalegalRate(e.target.value)}
                              className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              placeholder={
                                defaultRates
                                  ? centsToLei(defaultRates.paralegalRate).toFixed(2)
                                  : '0.00'
                              }
                              disabled={isLoading}
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

                {/* Step 1 Navigation Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      Anulează
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
                  >
                    Continuă
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

EditCaseModal.displayName = 'EditCaseModal';
