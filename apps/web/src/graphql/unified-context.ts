import { gql } from '@apollo/client';

// ============================================================================
// Unified Context Queries
// ============================================================================

/**
 * Get unified context for a case (Partners only)
 * Returns sections for UI display along with corrections and metadata
 */
export const GET_UNIFIED_CASE_CONTEXT = gql`
  query GetUnifiedCaseContext($caseId: ID!, $tier: ContextTier) {
    unifiedCaseContext(caseId: $caseId, tier: $tier) {
      entityType
      entityId
      tier
      content
      tokenCount
      sections {
        id
        title
        content
        tokenCount
      }
      references {
        refId
        refType
        title
        summary
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
 * Get unified context for a client (Partners only)
 * Returns sections for UI display along with corrections and metadata
 */
export const GET_UNIFIED_CLIENT_CONTEXT = gql`
  query GetUnifiedClientContext($clientId: ID!, $tier: ContextTier) {
    unifiedClientContext(clientId: $clientId, tier: $tier) {
      entityType
      entityId
      tier
      content
      tokenCount
      sections {
        id
        title
        content
        tokenCount
      }
      references {
        refId
        refType
        title
        summary
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

// ============================================================================
// Unified Context Mutations
// ============================================================================

/**
 * Add a correction using the unified context system
 */
export const ADD_UNIFIED_CONTEXT_CORRECTION = gql`
  mutation AddUnifiedContextCorrection($input: AddUnifiedCorrectionInput!) {
    addUnifiedContextCorrection(input: $input) {
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
 * Update a correction using the unified context system
 */
export const UPDATE_UNIFIED_CONTEXT_CORRECTION = gql`
  mutation UpdateUnifiedContextCorrection($input: UpdateUnifiedCorrectionInput!) {
    updateUnifiedContextCorrection(input: $input) {
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
 * Delete a correction using the unified context system
 */
export const DELETE_UNIFIED_CONTEXT_CORRECTION = gql`
  mutation DeleteUnifiedContextCorrection($correctionId: ID!) {
    deleteUnifiedContextCorrection(correctionId: $correctionId)
  }
`;

/**
 * Regenerate unified case context (Partners only)
 */
export const REGENERATE_UNIFIED_CASE_CONTEXT = gql`
  mutation RegenerateUnifiedCaseContext($caseId: ID!) {
    regenerateUnifiedCaseContext(caseId: $caseId)
  }
`;

/**
 * Regenerate unified client context (Partners only)
 */
export const REGENERATE_UNIFIED_CLIENT_CONTEXT = gql`
  mutation RegenerateUnifiedClientContext($clientId: ID!) {
    regenerateUnifiedClientContext(clientId: $clientId)
  }
`;

// ============================================================================
// Types
// ============================================================================

export type ContextEntityType = 'CLIENT' | 'CASE';
export type ContextTier = 'critical' | 'standard' | 'full';
export type CorrectionType = 'override' | 'append' | 'remove' | 'note';

export interface ContextSection {
  id: string;
  title: string;
  content: string;
  tokenCount: number;
}

export interface ContextReferenceInfo {
  refId: string;
  refType: 'DOCUMENT' | 'EMAIL' | 'THREAD';
  title: string;
  summary?: string;
}

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

export interface UnifiedContextResult {
  entityType: ContextEntityType;
  entityId: string;
  tier: ContextTier;
  content: string;
  tokenCount: number;
  sections: ContextSection[];
  references: ContextReferenceInfo[];
  corrections: UserCorrection[];
  version: number;
  generatedAt: string;
  validUntil: string;
}

export interface AddUnifiedCorrectionInput {
  entityType: ContextEntityType;
  entityId: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: CorrectionType;
  originalValue?: string;
  correctedValue: string;
  reason?: string;
}

export interface UpdateUnifiedCorrectionInput {
  correctionId: string;
  correctedValue?: string;
  reason?: string;
  isActive?: boolean;
}
