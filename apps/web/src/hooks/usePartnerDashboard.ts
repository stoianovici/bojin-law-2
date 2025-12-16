/**
 * Partner Dashboard Data Hook
 * Fetches real case data for the Partner Dashboard widgets
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { CaseStatus } from '@legal-platform/types';

// GraphQL query for dashboard cases
const GET_DASHBOARD_CASES = gql`
  query GetDashboardCases {
    cases {
      id
      caseNumber
      title
      status
      type
      value
      openedDate
      closedDate
      client {
        id
        name
      }
      teamMembers {
        id
        userId
        role
        user {
          id
          firstName
          lastName
        }
      }
    }
  }
`;

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface DashboardCase {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  type: string;
  value: number | null;
  openedDate: string;
  closedDate: string | null;
  client: {
    id: string;
    name: string;
  };
  teamMembers: TeamMember[];
}

interface UsePartnerDashboardResult {
  // Supervised cases (Active cases where current user is Lead)
  supervisedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    status: CaseStatus;
    teamSize: number;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
  // High value cases (cases with value > 100k)
  highValueCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    value: number;
    assignedPartner: string;
    priority: 'strategic' | 'vip' | 'normal';
  }>;
  // At-risk cases (OnHold or stale Active cases)
  atRiskCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    reason: string;
    assignedPartner: string;
  }>;
  // Pending approval cases
  pendingApprovalCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
  }>;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch and transform case data for Partner Dashboard widgets
 */
export function usePartnerDashboard(): UsePartnerDashboardResult {
  const { data, loading, error, refetch } = useQuery<{ cases: DashboardCase[] }>(
    GET_DASHBOARD_CASES,
    {
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
    }
  );

  const cases = data?.cases || [];

  // Get Lead partner name for a case
  const getLeadPartner = (teamMembers: TeamMember[]): string => {
    const lead = teamMembers.find((m) => m.role === 'Lead');
    return lead ? `${lead.user.firstName} ${lead.user.lastName}` : 'Unassigned';
  };

  // Transform supervised cases (Active cases)
  const supervisedCases = cases
    .filter((c) => c.status === 'Active')
    .slice(0, 5) // Limit to 5 for dashboard
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      clientName: c.client.name,
      status: c.status,
      teamSize: c.teamMembers.length,
      riskLevel: (c.value && c.value > 100000
        ? 'high'
        : c.value && c.value > 50000
          ? 'medium'
          : 'low') as 'high' | 'medium' | 'low',
    }));

  // Transform high value cases (value > 100k)
  const highValueCases = cases
    .filter((c) => c.value && c.value > 100000 && c.status !== 'Archived')
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      value: c.value || 0,
      assignedPartner: getLeadPartner(c.teamMembers),
      priority: (c.value && c.value > 200000 ? 'strategic' : 'vip') as
        | 'strategic'
        | 'vip'
        | 'normal',
    }));

  // Transform at-risk cases (OnHold cases)
  const atRiskCases = cases
    .filter((c) => c.status === 'OnHold')
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      reason: 'On Hold - awaiting action',
      assignedPartner: getLeadPartner(c.teamMembers),
    }));

  // Transform pending approval cases
  const pendingApprovalCases = cases
    .filter((c) => c.status === 'PendingApproval')
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      clientName: c.client.name,
    }));

  return {
    supervisedCases,
    highValueCases,
    atRiskCases,
    pendingApprovalCases,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
