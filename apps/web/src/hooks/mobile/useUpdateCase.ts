'use client';

import { useMutation } from '@apollo/client/react';
import { UPDATE_CASE } from '@/graphql/mutations';
import { GET_CASES, GET_CASE } from '@/graphql/queries';

export interface UpdateCaseInput {
  title?: string;
  type?: string;
  description?: string;
  status?: string;
  teamMembers?: { userId: string; role: string }[];
  keywords?: string[];
  emailDomains?: string[];
  courtFileNumbers?: string[];
  billingType?: 'HOURLY' | 'FIXED';
  fixedAmount?: number;
  hourlyRates?: { partner?: number; associate?: number; paralegal?: number };
  estimatedValue?: number;
}

export interface UpdateCaseErrors {
  title?: string;
  type?: string;
  description?: string;
  teamMembers?: string;
  fixedAmount?: string;
}

export function validateUpdateCaseInput(input: Partial<UpdateCaseInput>): UpdateCaseErrors {
  const errors: UpdateCaseErrors = {};

  if (input.title !== undefined && (!input.title?.trim() || input.title.trim().length < 3)) {
    errors.title = 'Titlul este obligatoriu (minim 3 caractere)';
  }

  if (
    input.description !== undefined &&
    (!input.description?.trim() || input.description.trim().length < 10)
  ) {
    errors.description = 'Descrierea este obligatorie (minim 10 caractere)';
  }

  // Must have exactly one Lead if teamMembers is provided
  if (input.teamMembers !== undefined) {
    const leads = input.teamMembers?.filter((m) => m.role === 'Lead') ?? [];
    if (leads.length !== 1) {
      errors.teamMembers = 'Trebuie să existe exact un responsabil (Lead)';
    }
  }

  if (input.billingType === 'FIXED' && !input.fixedAmount) {
    errors.fixedAmount = 'Suma fixă este obligatorie pentru facturare fixă';
  }

  return errors;
}

interface UpdateCaseData {
  updateCase: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    type: string;
    description: string;
    client: {
      id: string;
      name: string;
    };
    teamMembers: {
      id: string;
      role: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
      };
    }[];
    updatedAt: string;
  };
}

// Backend-compatible input type
// Note: Backend expects 'customRates' with 'partnerRate/associateRate/paralegalRate' fields
interface BackendUpdateCaseInput {
  title?: string;
  type?: string;
  description?: string;
  status?: string;
  billingType?: string;
  fixedAmount?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
}

export function useUpdateCase() {
  const [updateCaseMutation, { loading, error }] = useMutation<
    UpdateCaseData,
    { id: string; input: BackendUpdateCaseInput }
  >(UPDATE_CASE, {
    refetchQueries: [{ query: GET_CASES }],
  });

  const updateCase = async (id: string, input: UpdateCaseInput) => {
    // Transform frontend input to backend-compatible format
    const backendInput: BackendUpdateCaseInput = {};

    if (input.title !== undefined) {
      backendInput.title = input.title;
    }
    if (input.type !== undefined) {
      backendInput.type = input.type;
    }
    if (input.description !== undefined) {
      backendInput.description = input.description;
    }
    if (input.status !== undefined) {
      backendInput.status = input.status;
    }
    if (input.billingType !== undefined) {
      // Fix billingType enum case: "HOURLY" -> "Hourly", "FIXED" -> "Fixed"
      backendInput.billingType =
        input.billingType === 'HOURLY'
          ? 'Hourly'
          : input.billingType === 'FIXED'
            ? 'Fixed'
            : undefined;
    }
    if (input.fixedAmount !== undefined) {
      backendInput.fixedAmount = input.fixedAmount;
    }
    // Map frontend hourlyRates to backend customRates with correct field names
    if (input.hourlyRates !== undefined) {
      backendInput.customRates = {
        partnerRate: input.hourlyRates.partner,
        associateRate: input.hourlyRates.associate,
        paralegalRate: input.hourlyRates.paralegal,
      };
    }

    const result = await updateCaseMutation({
      variables: { id, input: backendInput },
      refetchQueries: [{ query: GET_CASES }, { query: GET_CASE, variables: { id } }],
    });
    return result.data?.updateCase;
  };

  return {
    updateCase,
    loading,
    error,
    validate: validateUpdateCaseInput,
  };
}
