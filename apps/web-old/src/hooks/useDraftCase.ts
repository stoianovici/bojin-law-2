/**
 * Draft Case Hook
 * OPS-208: useDraftCase Hook
 *
 * Manages draft case state for new case creation with browser navigation warning.
 * Used by the expandable case workspace to create new cases inline.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCaseCreate, type CreateCaseInput } from './useCaseCreate';
import type { CaseActorRole, BillingType, Case } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface DraftActor {
  /** Temporary ID for tracking in UI */
  tempId: string;
  name: string;
  role: CaseActorRole;
  customRoleCode?: string; // OPS-223: For custom actor types
  email?: string;
  emailDomains?: string[];
  organization?: string;
  phone?: string;
}

export interface DraftReference {
  key: string;
  value: string;
}

export interface DraftBilling {
  type: BillingType;
  fixedAmount?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
}

export interface DraftCase {
  title: string;
  caseNumber: string;
  description: string;
  clientName: string;
  type: string;
  value?: number;
  actors: DraftActor[];
  references: DraftReference[];
  billing: DraftBilling;
}

export interface UseDraftCaseResult {
  /** Current draft state */
  draft: DraftCase;
  /** Whether draft has unsaved changes */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Error from last save attempt */
  saveError?: string;

  // Field updates
  updateField: <K extends keyof DraftCase>(field: K, value: DraftCase[K]) => void;

  // Actor management
  addActor: (role: CaseActorRole) => void;
  updateActor: (tempId: string, updates: Partial<Omit<DraftActor, 'tempId'>>) => void;
  removeActor: (tempId: string) => void;

  // Reference management
  addReference: (key: string, value: string) => void;
  updateReference: (index: number, key: string, value: string) => void;
  removeReference: (index: number) => void;

  // Billing management
  updateBilling: (updates: Partial<DraftBilling>) => void;

  // Actions
  save: () => Promise<{ success: boolean; case?: Case; error?: string }>;
  reset: () => void;

  // Validation
  isValid: boolean;
  validationErrors: Record<string, string>;
}

// ============================================================================
// Initial State
// ============================================================================

const createInitialDraft = (): DraftCase => ({
  title: '',
  caseNumber: '',
  description: '',
  clientName: '',
  type: '',
  value: undefined,
  actors: [
    {
      tempId: generateTempId(),
      name: '',
      role: 'Client',
      emailDomains: [],
    },
  ],
  references: [],
  billing: {
    type: 'Hourly',
  },
});

// ============================================================================
// Helpers
// ============================================================================

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useDraftCase(): UseDraftCaseResult {
  const [draft, setDraft] = useState<DraftCase>(createInitialDraft);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const { createCase, loading: isSaving } = useCaseCreate();

  // ============================================================================
  // Browser Navigation Warning
  // ============================================================================

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a warning
      e.returnValue = 'Aveți modificări nesalvate. Sigur doriți să părăsiți pagina?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ============================================================================
  // Field Updates
  // ============================================================================

  const updateField = useCallback(<K extends keyof DraftCase>(field: K, value: DraftCase[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  // ============================================================================
  // Actor Management
  // ============================================================================

  const addActor = useCallback((role: CaseActorRole) => {
    setDraft((prev) => ({
      ...prev,
      actors: [
        ...prev.actors,
        {
          tempId: generateTempId(),
          name: '',
          role,
          emailDomains: [],
        },
      ],
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  const updateActor = useCallback(
    (tempId: string, updates: Partial<Omit<DraftActor, 'tempId'>>) => {
      setDraft((prev) => ({
        ...prev,
        actors: prev.actors.map((actor) =>
          actor.tempId === tempId ? { ...actor, ...updates } : actor
        ),
      }));
      setIsDirty(true);
      setSaveError(undefined);
    },
    []
  );

  const removeActor = useCallback((tempId: string) => {
    setDraft((prev) => ({
      ...prev,
      actors: prev.actors.filter((actor) => actor.tempId !== tempId),
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  // ============================================================================
  // Reference Management
  // ============================================================================

  const addReference = useCallback((key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      references: [...prev.references, { key, value }],
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  const updateReference = useCallback((index: number, key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      references: prev.references.map((ref, i) => (i === index ? { key, value } : ref)),
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  const removeReference = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      references: prev.references.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  // ============================================================================
  // Billing Management
  // ============================================================================

  const updateBilling = useCallback((updates: Partial<DraftBilling>) => {
    setDraft((prev) => ({
      ...prev,
      billing: { ...prev.billing, ...updates },
    }));
    setIsDirty(true);
    setSaveError(undefined);
  }, []);

  // ============================================================================
  // Validation
  // ============================================================================

  const { isValid, validationErrors } = useMemo(() => {
    const errors: Record<string, string> = {};

    // Title validation
    if (!draft.title.trim()) {
      errors.title = 'Titlul este obligatoriu';
    } else if (draft.title.length < 3) {
      errors.title = 'Titlul trebuie să aibă cel puțin 3 caractere';
    } else if (draft.title.length > 500) {
      errors.title = 'Titlul nu poate depăși 500 de caractere';
    }

    // Client name validation
    if (!draft.clientName.trim()) {
      errors.clientName = 'Numele clientului este obligatoriu';
    } else if (draft.clientName.length < 2) {
      errors.clientName = 'Numele clientului trebuie să aibă cel puțin 2 caractere';
    }

    // Type validation
    if (!draft.type) {
      errors.type = 'Tipul dosarului este obligatoriu';
    }

    // Description validation (optional field, but if provided must be meaningful)
    if (draft.description.trim() && draft.description.trim().length < 10) {
      errors.description = 'Descrierea trebuie să aibă cel puțin 10 caractere';
    }

    // Client actor validation
    const clientActors = draft.actors.filter((a) => a.role === 'Client');
    if (clientActors.length === 0) {
      errors.actors = 'Este necesar cel puțin un contact de tip Client';
    } else {
      const hasClientWithName = clientActors.some((c) => c.name.trim().length > 0);
      if (!hasClientWithName) {
        errors.actors = 'Clientul trebuie să aibă un nume';
      }
    }

    // Fixed billing validation
    if (draft.billing.type === 'Fixed' && !draft.billing.fixedAmount) {
      errors.fixedAmount = 'Suma fixă este obligatorie pentru facturare fixă';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      validationErrors: errors,
    };
  }, [draft]);

  // ============================================================================
  // Save
  // ============================================================================

  const save = useCallback(async (): Promise<{
    success: boolean;
    case?: Case;
    error?: string;
  }> => {
    if (!isValid) {
      const errorMessage = Object.values(validationErrors).join('. ');
      setSaveError(errorMessage);
      return { success: false, error: errorMessage };
    }

    setSaveError(undefined);

    // Convert to CreateCaseInput format
    const input: CreateCaseInput = {
      title: draft.title.trim(),
      caseNumber: draft.caseNumber.trim() || undefined,
      clientName: draft.clientName.trim(),
      type: draft.type,
      description: draft.description.trim(),
      value: draft.value,
      billingType: draft.billing.type,
      fixedAmount: draft.billing.fixedAmount,
      customRates: draft.billing.customRates,
    };

    const result = await createCase(input);

    if (result.success) {
      setIsDirty(false);
      // Note: Actor addition will be handled by the calling component
      // since it requires the case ID from the response
    } else {
      setSaveError(result.error);
    }

    return result;
  }, [draft, isValid, validationErrors, createCase]);

  // ============================================================================
  // Reset
  // ============================================================================

  const reset = useCallback(() => {
    setDraft(createInitialDraft());
    setIsDirty(false);
    setSaveError(undefined);
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    draft,
    isDirty,
    isSaving,
    saveError,
    updateField,
    addActor,
    updateActor,
    removeActor,
    addReference,
    updateReference,
    removeReference,
    updateBilling,
    save,
    reset,
    isValid,
    validationErrors,
  };
}
