'use client';

import { useMutation } from '@apollo/client/react';
import {
  UPDATE_CASE,
  UPDATE_CASE_METADATA,
  ASSIGN_TEAM_MEMBER,
  REMOVE_TEAM_MEMBER,
} from '@/graphql/mutations';
import { GET_CASES, GET_CASE } from '@/graphql/queries';

export interface UpdateCaseInput {
  title?: string;
  type?: string;
  description?: string;
  status?: string;
  teamMembers?: { userId: string; role: string }[];
  keywords?: string[];
  courtFileNumbers?: string[];
  billingType?: 'HOURLY' | 'FIXED' | 'RETAINER';
  fixedAmount?: number;
  hourlyRates?: { partner?: number; associate?: number; paralegal?: number };
  retainerAmount?: number;
  retainerPeriod?: 'Monthly' | 'Quarterly' | 'Annually';
  retainerAutoRenew?: boolean;
  retainerRollover?: boolean;
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
  value?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
  retainerAmount?: number;
  retainerPeriod?: string;
  retainerAutoRenew?: boolean;
  retainerRollover?: boolean;
}

interface CaseMetadataInput {
  keywords?: string[];
  referenceNumbers?: string[];
}

interface OriginalTeamMember {
  userId: string;
  role: string;
}

export function useUpdateCase() {
  const [updateCaseMutation, { loading: caseLoading, error: caseError }] = useMutation<
    UpdateCaseData,
    { id: string; input: BackendUpdateCaseInput }
  >(UPDATE_CASE, {
    refetchQueries: [{ query: GET_CASES }],
  });

  const [updateMetadataMutation, { loading: metadataLoading }] = useMutation(UPDATE_CASE_METADATA);

  const [assignTeamMutation] = useMutation(ASSIGN_TEAM_MEMBER);

  const [removeTeamMutation] = useMutation(REMOVE_TEAM_MEMBER);

  const updateCase = async (
    id: string,
    input: UpdateCaseInput,
    originalTeamMembers?: OriginalTeamMember[]
  ) => {
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
      // Fix billingType enum case: "HOURLY" -> "Hourly", "FIXED" -> "Fixed", "RETAINER" -> "Retainer"
      backendInput.billingType =
        input.billingType === 'HOURLY'
          ? 'Hourly'
          : input.billingType === 'FIXED'
            ? 'Fixed'
            : input.billingType === 'RETAINER'
              ? 'Retainer'
              : undefined;
    }
    if (input.fixedAmount !== undefined) {
      backendInput.fixedAmount = input.fixedAmount;
    }
    // Map frontend estimatedValue to backend value field
    if (input.estimatedValue !== undefined) {
      backendInput.value = input.estimatedValue;
    }
    // Map frontend hourlyRates to backend customRates with correct field names
    if (input.hourlyRates !== undefined) {
      backendInput.customRates = {
        partnerRate: input.hourlyRates.partner,
        associateRate: input.hourlyRates.associate,
        paralegalRate: input.hourlyRates.paralegal,
      };
    }
    // Map retainer fields
    if (input.retainerAmount !== undefined) {
      backendInput.retainerAmount = input.retainerAmount;
    }
    if (input.retainerPeriod !== undefined) {
      backendInput.retainerPeriod = input.retainerPeriod;
    }
    if (input.retainerAutoRenew !== undefined) {
      backendInput.retainerAutoRenew = input.retainerAutoRenew;
    }
    if (input.retainerRollover !== undefined) {
      backendInput.retainerRollover = input.retainerRollover;
    }

    // Execute all mutations
    const promises: Promise<unknown>[] = [];

    // 1. Update basic case fields
    promises.push(
      updateCaseMutation({
        variables: { id, input: backendInput },
        refetchQueries: [{ query: GET_CASES }, { query: GET_CASE, variables: { id } }],
      })
    );

    // 2. Update metadata (keywords and referenceNumbers) if provided
    const hasMetadataChanges = input.keywords !== undefined || input.courtFileNumbers !== undefined;
    if (hasMetadataChanges) {
      const metadataInput: CaseMetadataInput = {};
      if (input.keywords !== undefined) {
        metadataInput.keywords = input.keywords;
      }
      if (input.courtFileNumbers !== undefined) {
        metadataInput.referenceNumbers = input.courtFileNumbers;
      }
      promises.push(
        updateMetadataMutation({
          variables: { caseId: id, input: metadataInput },
          refetchQueries: [{ query: GET_CASE, variables: { id } }],
        })
      );
    }

    // 3. Update team members if provided and we have original team members to compare
    if (input.teamMembers !== undefined && originalTeamMembers !== undefined) {
      const newMembers = input.teamMembers;
      const originalMemberIds = new Set(originalTeamMembers.map((m) => m.userId));
      const newMemberIds = new Set(newMembers.map((m) => m.userId));

      // Find members to remove (in original but not in new)
      const toRemove = originalTeamMembers.filter((m) => !newMemberIds.has(m.userId));

      // Find members to add (in new but not in original)
      const toAdd = newMembers.filter((m) => !originalMemberIds.has(m.userId));

      // Find members with changed roles
      const toUpdateRole = newMembers.filter((m) => {
        const original = originalTeamMembers.find((o) => o.userId === m.userId);
        return original && original.role !== m.role;
      });

      // Remove members
      for (const member of toRemove) {
        promises.push(
          removeTeamMutation({
            variables: { caseId: id, userId: member.userId },
          })
        );
      }

      // Add new members
      for (const member of toAdd) {
        promises.push(
          assignTeamMutation({
            variables: { input: { caseId: id, userId: member.userId, role: member.role } },
          })
        );
      }

      // Update roles (remove and re-add with new role)
      for (const member of toUpdateRole) {
        // For role updates, we need to remove and re-assign
        promises.push(
          removeTeamMutation({
            variables: { caseId: id, userId: member.userId },
          }).then(() =>
            assignTeamMutation({
              variables: { input: { caseId: id, userId: member.userId, role: member.role } },
            })
          )
        );
      }
    }

    // Wait for all mutations to complete
    await Promise.all(promises);

    // Return the updated case from the first mutation
    const result = await updateCaseMutation({
      variables: { id, input: backendInput },
      refetchQueries: [{ query: GET_CASES }, { query: GET_CASE, variables: { id } }],
    });
    return result.data?.updateCase;
  };

  return {
    updateCase,
    loading: caseLoading || metadataLoading,
    error: caseError,
    validate: validateUpdateCaseInput,
  };
}
