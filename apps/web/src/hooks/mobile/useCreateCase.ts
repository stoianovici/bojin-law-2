'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_CASE } from '@/graphql/mutations';
import { GET_CASES } from '@/graphql/queries';

export interface CreateCaseContactInput {
  email: string;
  name?: string;
  role?: string;
}

export interface ClientPersonInput {
  id?: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface CompanyDetailsInput {
  clientType: 'individual' | 'company';
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  administrators?: ClientPersonInput[];
  contacts?: ClientPersonInput[];
}

export interface CreateCaseInput {
  title: string;
  clientId: string;
  /** @deprecated Use clientId instead */
  clientName?: string;
  /** Client email - for creating new clients */
  clientEmail?: string;
  /** Client phone - for creating new clients */
  clientPhone?: string;
  /** Client address - for creating new clients */
  clientAddress?: string;
  /** Company details - for creating new clients */
  companyDetails?: CompanyDetailsInput;
  type: string;
  description: string;
  teamMembers: { userId: string; role: string }[];
  keywords: string[];
  emailDomains: string[];
  courtFileNumbers: string[];
  billingType: 'HOURLY' | 'FIXED';
  fixedAmount?: number;
  hourlyRates?: { partner?: number; associate?: number; paralegal?: number };
  estimatedValue?: number;
  contacts?: CreateCaseContactInput[];
}

export interface CreateCaseErrors {
  title?: string;
  clientId?: string;
  type?: string;
  description?: string;
  teamMembers?: string;
  billingType?: string;
  fixedAmount?: string;
}

export function validateCreateCaseInput(input: Partial<CreateCaseInput>): CreateCaseErrors {
  const errors: CreateCaseErrors = {};

  if (!input.title?.trim() || input.title.trim().length < 3) {
    errors.title = 'Titlul este obligatoriu (minim 3 caractere)';
  }

  if (!input.clientId) {
    errors.clientId = 'Selectați un client';
  }

  if (!input.type) {
    errors.type = 'Selectați tipul dosarului';
  }

  if (!input.description?.trim() || input.description.trim().length < 10) {
    errors.description = 'Descrierea este obligatorie (minim 10 caractere)';
  }

  // Must have exactly one Lead
  const leads = input.teamMembers?.filter((m) => m.role === 'Lead') ?? [];
  if (leads.length !== 1) {
    errors.teamMembers = 'Trebuie să existe exact un responsabil (Lead)';
  }

  if (input.billingType === 'FIXED' && !input.fixedAmount) {
    errors.fixedAmount = 'Suma fixă este obligatorie pentru facturare fixă';
  }

  return errors;
}

interface CreateCaseData {
  createCase: {
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
    createdAt: string;
  };
}

// Backend-compatible input type (subset of frontend CreateCaseInput)
// Note: Backend requires clientName and does NOT accept clientId
interface BackendCreateCaseInput {
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  // Company details for new client
  clientType?: string;
  companyType?: string;
  clientCui?: string;
  clientRegistrationNumber?: string;
  clientAdministrators?: Array<{
    id?: string;
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
  clientContacts?: Array<{
    id?: string;
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
  type: string;
  description: string;
  value?: number;
  billingType?: string;
  fixedAmount?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
  contacts?: Array<{
    email: string;
    name?: string;
    role?: string;
  }>;
  teamMembers?: Array<{
    userId: string;
    role: string;
  }>;
  keywords?: string[];
  referenceNumbers?: string[];
}

export function useCreateCase() {
  const [createCaseMutation, { loading, error }] = useMutation<
    CreateCaseData,
    { input: BackendCreateCaseInput }
  >(CREATE_CASE, {
    refetchQueries: [{ query: GET_CASES }],
  });

  const createCase = async (input: CreateCaseInput) => {
    // Ensure clientName is provided (backend requires it)
    if (!input.clientName) {
      throw new Error('Client name is required');
    }

    // Transform frontend input to backend-compatible format
    // Only send fields the backend accepts (clientName, NOT clientId)
    const backendInput: BackendCreateCaseInput = {
      title: input.title,
      clientName: input.clientName,
      type: input.type,
      description: input.description,
      // Fix billingType enum case: "HOURLY" -> "Hourly", "FIXED" -> "Fixed"
      billingType:
        input.billingType === 'HOURLY'
          ? 'Hourly'
          : input.billingType === 'FIXED'
            ? 'Fixed'
            : undefined,
    };

    // Include client contact info for new client creation
    if (input.clientEmail?.trim()) {
      backendInput.clientEmail = input.clientEmail.trim();
    }
    if (input.clientPhone?.trim()) {
      backendInput.clientPhone = input.clientPhone.trim();
    }
    if (input.clientAddress?.trim()) {
      backendInput.clientAddress = input.clientAddress.trim();
    }

    // Include company details for new client creation
    if (input.companyDetails) {
      backendInput.clientType = input.companyDetails.clientType;
      if (input.companyDetails.companyType) {
        backendInput.companyType = input.companyDetails.companyType;
      }
      if (input.companyDetails.cui?.trim()) {
        backendInput.clientCui = input.companyDetails.cui.trim();
      }
      if (input.companyDetails.registrationNumber?.trim()) {
        backendInput.clientRegistrationNumber = input.companyDetails.registrationNumber.trim();
      }
      if (input.companyDetails.administrators && input.companyDetails.administrators.length > 0) {
        backendInput.clientAdministrators = input.companyDetails.administrators;
      }
      if (input.companyDetails.contacts && input.companyDetails.contacts.length > 0) {
        backendInput.clientContacts = input.companyDetails.contacts;
      }
    }

    // Include estimated value
    if (input.estimatedValue !== undefined && input.estimatedValue > 0) {
      backendInput.value = input.estimatedValue;
    }

    // Include fixedAmount when billing type is FIXED
    if (input.billingType === 'FIXED' && input.fixedAmount) {
      backendInput.fixedAmount = input.fixedAmount;
    }

    // Include custom hourly rates if provided
    if (input.hourlyRates) {
      backendInput.customRates = {
        partnerRate: input.hourlyRates.partner,
        associateRate: input.hourlyRates.associate,
        paralegalRate: input.hourlyRates.paralegal,
      };
    }

    // Include contacts for historical email sync
    if (input.contacts && input.contacts.length > 0) {
      backendInput.contacts = input.contacts;
    }

    // Include team members
    if (input.teamMembers && input.teamMembers.length > 0) {
      backendInput.teamMembers = input.teamMembers;
    }

    // Include classification fields
    if (input.keywords && input.keywords.length > 0) {
      backendInput.keywords = input.keywords;
    }
    // Map courtFileNumbers to referenceNumbers
    if (input.courtFileNumbers && input.courtFileNumbers.length > 0) {
      backendInput.referenceNumbers = input.courtFileNumbers;
    }

    const result = await createCaseMutation({ variables: { input: backendInput } });
    return result.data?.createCase;
  };

  return {
    createCase,
    loading,
    error,
    validate: validateCreateCaseInput,
  };
}
