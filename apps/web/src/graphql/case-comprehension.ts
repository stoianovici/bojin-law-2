import { gql } from '@apollo/client';

// ============================================================================
// Case Comprehension Queries
// ============================================================================

/**
 * Get comprehension for a case
 * Returns the AI-generated "Current Picture" narrative with data map
 */
export const GET_CASE_COMPREHENSION = gql`
  query GetCaseComprehension($caseId: ID!, $tier: ComprehensionTier) {
    caseComprehension(caseId: $caseId, tier: $tier) {
      id
      caseId
      currentPicture
      contentStandard
      contentCritical
      dataMap {
        sources {
          id
          type
          title
          topics
          tokenEstimate
          excerpt
          fileType
          pageCount
          messageCount
          participants
          lastMessageDate
        }
      }
      tokensFull
      tokensStandard
      tokensCritical
      version
      generatedAt
      validUntil
      isStale
      corrections {
        id
        anchorText
        correctionType
        correctedValue
        reason
        isActive
        appliedAt
        createdAt
      }
    }
  }
`;

/**
 * Get comprehension agent runs for debugging/audit
 */
export const GET_COMPREHENSION_AGENT_RUNS = gql`
  query GetComprehensionAgentRuns($caseId: ID!, $limit: Int) {
    comprehensionAgentRuns(caseId: $caseId, limit: $limit) {
      id
      caseId
      trigger
      triggerEvent
      status
      startedAt
      completedAt
      durationMs
      tokensUsed
      error
      createdAt
    }
  }
`;

// ============================================================================
// Case Comprehension Mutations
// ============================================================================

/**
 * Generate or regenerate comprehension for a case
 */
export const GENERATE_CASE_COMPREHENSION = gql`
  mutation GenerateCaseComprehension($caseId: ID!) {
    generateCaseComprehension(caseId: $caseId) {
      id
      caseId
      currentPicture
      contentStandard
      contentCritical
      dataMap {
        sources {
          id
          type
          title
          topics
          tokenEstimate
          excerpt
        }
      }
      tokensFull
      tokensStandard
      tokensCritical
      version
      generatedAt
      validUntil
      isStale
      corrections {
        id
        anchorText
        correctionType
        correctedValue
        reason
        isActive
        appliedAt
        createdAt
      }
    }
  }
`;

/**
 * Add a correction to comprehension
 */
export const ADD_COMPREHENSION_CORRECTION = gql`
  mutation AddComprehensionCorrection($input: AddComprehensionCorrectionInput!) {
    addComprehensionCorrection(input: $input) {
      id
      anchorText
      correctionType
      correctedValue
      reason
      isActive
      appliedAt
      createdAt
    }
  }
`;

/**
 * Toggle correction active state
 */
export const UPDATE_COMPREHENSION_CORRECTION = gql`
  mutation UpdateComprehensionCorrection($id: ID!, $isActive: Boolean!) {
    updateComprehensionCorrection(id: $id, isActive: $isActive) {
      id
      anchorText
      correctionType
      correctedValue
      reason
      isActive
      appliedAt
      createdAt
    }
  }
`;

/**
 * Delete a correction (soft delete)
 */
export const DELETE_COMPREHENSION_CORRECTION = gql`
  mutation DeleteComprehensionCorrection($id: ID!) {
    deleteComprehensionCorrection(id: $id)
  }
`;

// ============================================================================
// Types
// ============================================================================

export type ComprehensionTier = 'FULL' | 'STANDARD' | 'CRITICAL';
export type ComprehensionCorrectionType = 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE';
export type AgentRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface DataMapSource {
  id: string;
  type: 'document' | 'email_thread' | 'task';
  title: string;
  topics: string[];
  tokenEstimate: number;
  excerpt?: string;
  fileType?: string;
  pageCount?: number;
  messageCount?: number;
  participants?: string[];
  lastMessageDate?: string;
}

export interface DataMap {
  sources: DataMapSource[];
}

export interface ComprehensionCorrection {
  id: string;
  anchorText: string;
  correctionType: ComprehensionCorrectionType;
  correctedValue: string;
  reason?: string;
  isActive: boolean;
  appliedAt?: string;
  createdAt: string;
}

export interface CaseComprehension {
  id: string;
  caseId: string;
  currentPicture: string;
  contentStandard: string;
  contentCritical: string;
  dataMap: DataMap;
  tokensFull: number;
  tokensStandard: number;
  tokensCritical: number;
  version: number;
  generatedAt: string;
  validUntil: string;
  isStale: boolean;
  corrections: ComprehensionCorrection[];
}

export interface ComprehensionAgentRun {
  id: string;
  caseId: string;
  trigger: string;
  triggerEvent?: string;
  status: AgentRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokensUsed?: number;
  error?: string;
  createdAt: string;
}

export interface AddComprehensionCorrectionInput {
  caseId: string;
  anchorText: string;
  correctionType: ComprehensionCorrectionType;
  correctedValue: string;
  reason?: string;
}
