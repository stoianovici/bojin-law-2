import { gql } from '@apollo/client';

// ============================================================================
// Case Context Queries
// ============================================================================

/**
 * Get the AI context file for a case
 */
export const GET_CASE_CONTEXT_FILE = gql`
  query GetCaseContextFile($caseId: ID!, $profileCode: String) {
    caseContextFile(caseId: $caseId, profileCode: $profileCode) {
      caseId
      profileCode
      content
      tokenCount
      sections {
        id
        title
        content
        tokenCount
      }
      corrections {
        id
        sectionId
        fieldPath
        correctionType
        originalValue
        correctedValue
        reason
        createdAt
        createdBy
        isActive
      }
      version
      generatedAt
      validUntil
    }
  }
`;

/**
 * Get all corrections for a case
 */
export const GET_CASE_CONTEXT_CORRECTIONS = gql`
  query GetCaseContextCorrections($caseId: ID!) {
    caseContextCorrections(caseId: $caseId) {
      id
      sectionId
      fieldPath
      correctionType
      originalValue
      correctedValue
      reason
      createdAt
      createdBy
      isActive
    }
  }
`;

// ============================================================================
// Case Context Mutations
// ============================================================================

/**
 * Add a correction to case context
 */
export const ADD_CASE_CONTEXT_CORRECTION = gql`
  mutation AddCaseContextCorrection($input: AddCorrectionInput!) {
    addCaseContextCorrection(input: $input) {
      id
      sectionId
      fieldPath
      correctionType
      originalValue
      correctedValue
      reason
      createdAt
      createdBy
      isActive
    }
  }
`;

/**
 * Update an existing correction
 */
export const UPDATE_CASE_CONTEXT_CORRECTION = gql`
  mutation UpdateCaseContextCorrection($input: UpdateCorrectionInput!) {
    updateCaseContextCorrection(input: $input) {
      id
      sectionId
      fieldPath
      correctionType
      originalValue
      correctedValue
      reason
      createdAt
      createdBy
      isActive
    }
  }
`;

/**
 * Delete a correction
 */
export const DELETE_CASE_CONTEXT_CORRECTION = gql`
  mutation DeleteCaseContextCorrection($caseId: ID!, $correctionId: ID!) {
    deleteCaseContextCorrection(caseId: $caseId, correctionId: $correctionId)
  }
`;

/**
 * Regenerate case context (invalidate cache)
 */
export const REGENERATE_CASE_CONTEXT = gql`
  mutation RegenerateCaseContext($caseId: ID!) {
    regenerateCaseContext(caseId: $caseId)
  }
`;

// ============================================================================
// Types
// ============================================================================

export type CorrectionType = 'override' | 'append' | 'remove' | 'note';

export interface UserCorrection {
  id: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: CorrectionType;
  originalValue?: string;
  correctedValue: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface ContextSection {
  id: string;
  title: string;
  content: string;
  tokenCount: number;
}

export interface CaseContextFile {
  caseId: string;
  profileCode: string;
  content: string;
  tokenCount: number;
  sections: ContextSection[];
  corrections: UserCorrection[];
  version: number;
  generatedAt: string;
  validUntil: string;
}

export interface AddCorrectionInput {
  caseId: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: CorrectionType;
  originalValue?: string;
  correctedValue: string;
  reason?: string;
}

export interface UpdateCorrectionInput {
  correctionId: string;
  caseId: string;
  correctedValue?: string;
  reason?: string;
  isActive?: boolean;
}
