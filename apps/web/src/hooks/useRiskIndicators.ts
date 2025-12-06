/**
 * Risk Indicators React Hooks
 * Story 5.2: Communication Intelligence Engine
 *
 * Hooks for fetching and managing AI-detected risk indicators from communications.
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

export type RiskSeverity = 'Low' | 'Medium' | 'High';
export type RiskType =
  | 'MissedDeadline'
  | 'ContradictoryStatements'
  | 'UnresolvedDispute'
  | 'ComplianceRisk'
  | 'ClientDissatisfaction'
  | 'Other';

export interface RiskIndicator {
  id: string;
  emailId: string;
  caseId: string | null;
  riskType: RiskType;
  severity: RiskSeverity;
  description: string;
  evidence: string;
  suggestedAction: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  email?: { id: string; subject: string };
  case?: { id: string; title: string };
}

export interface CaseRiskSummary {
  caseId: string;
  totalRisks: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  unresolvedCount: number;
  risksByType: Array<{ type: RiskType; count: number }>;
}

export interface RiskIndicatorsFilter {
  caseId?: string;
  emailId?: string;
  severity?: RiskSeverity;
  riskType?: RiskType;
  isResolved?: boolean;
  fromDate?: string;
  toDate?: string;
}

// ============================================================================
// GraphQL Fragments
// ============================================================================

const RISK_INDICATOR_FRAGMENT = gql`
  fragment RiskIndicatorFields on RiskIndicator {
    id
    emailId
    caseId
    riskType
    severity
    description
    evidence
    suggestedAction
    isResolved
    resolvedAt
    resolvedBy
    resolutionNote
    createdAt
    email {
      id
      subject
    }
    case {
      id
      title
    }
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_RISK_INDICATORS = gql`
  ${RISK_INDICATOR_FRAGMENT}
  query GetRiskIndicators($filter: RiskIndicatorsFilter) {
    riskIndicators(filter: $filter) {
      ...RiskIndicatorFields
    }
  }
`;

const GET_CASE_RISK_SUMMARY = gql`
  query GetCaseRiskSummary($caseId: ID!) {
    caseRiskSummary(caseId: $caseId) {
      caseId
      totalRisks
      highSeverity
      mediumSeverity
      lowSeverity
      unresolvedCount
      risksByType {
        type
        count
      }
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const RESOLVE_RISK = gql`
  ${RISK_INDICATOR_FRAGMENT}
  mutation ResolveRisk($input: ResolveRiskInput!) {
    resolveRisk(input: $input) {
      ...RiskIndicatorFields
    }
  }
`;

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to fetch risk indicators with optional filters
 */
export function useRiskIndicators(filter?: RiskIndicatorsFilter) {
  return useQuery<{ riskIndicators: RiskIndicator[] }>(GET_RISK_INDICATORS, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to fetch risk indicators for a specific case
 */
export function useCaseRiskIndicators(caseId: string, additionalFilters?: Partial<RiskIndicatorsFilter>) {
  const filter: RiskIndicatorsFilter = { caseId, ...additionalFilters };
  return useRiskIndicators(filter);
}

/**
 * Hook to fetch unresolved high-severity risks for a case
 * Useful for the RiskAlertBanner component
 */
export function useHighSeverityRisks(caseId: string) {
  const filter: RiskIndicatorsFilter = {
    caseId,
    severity: 'High',
    isResolved: false,
  };
  return useRiskIndicators(filter);
}

/**
 * Hook to fetch case risk summary statistics
 */
export function useCaseRiskSummary(caseId: string) {
  return useQuery<{ caseRiskSummary: CaseRiskSummary }>(GET_CASE_RISK_SUMMARY, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to resolve a risk indicator
 */
export function useResolveRisk() {
  return useMutation<
    { resolveRisk: RiskIndicator },
    { input: { riskId: string; resolutionNote?: string } }
  >(RESOLVE_RISK, {
    refetchQueries: ['GetRiskIndicators', 'GetCaseRiskSummary'],
  });
}

/**
 * Composite hook for managing risks in a case view
 * Provides both data and actions
 */
export function useCaseRisks(caseId: string) {
  const { data: risksData, loading: risksLoading, error: risksError, refetch: refetchRisks } =
    useCaseRiskIndicators(caseId);
  const { data: summaryData, loading: summaryLoading, error: summaryError } =
    useCaseRiskSummary(caseId);
  const [resolveRisk, { loading: resolving }] = useResolveRisk();

  const handleResolveRisk = async (riskId: string, note?: string) => {
    try {
      await resolveRisk({
        variables: { input: { riskId, resolutionNote: note } },
      });
      refetchRisks();
      return { success: true };
    } catch (error) {
      console.error('Failed to resolve risk:', error);
      return { success: false, error };
    }
  };

  return {
    risks: risksData?.riskIndicators ?? [],
    summary: summaryData?.caseRiskSummary ?? null,
    loading: risksLoading || summaryLoading,
    error: risksError || summaryError,
    resolving,
    resolveRisk: handleResolveRisk,
    refetch: refetchRisks,
  };
}
