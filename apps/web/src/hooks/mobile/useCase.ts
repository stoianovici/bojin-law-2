'use client';

import { useQuery } from '@apollo/client/react';
import { GET_CASE } from '@/graphql/queries';

export interface CaseClient {
  id: string;
  name: string;
  contactInfo: string | null;
  address: string | null;
}

export interface CaseTeamMemberUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface CaseTeamMember {
  id: string;
  role: string;
  user: CaseTeamMemberUser;
}

export interface CaseActor {
  id: string;
  name: string;
  role: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
}

export interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  description: string | null;
  openedDate: string;
  closedDate: string | null;
  client: CaseClient;
  teamMembers: CaseTeamMember[];
  actors: CaseActor[];
  createdAt: string;
  updatedAt: string;
}

interface GetCaseQueryResult {
  case: CaseData;
}

interface UseCaseResult {
  caseData: CaseData | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

export function useCase(id: string): UseCaseResult {
  const { data, loading, error, refetch } = useQuery<GetCaseQueryResult>(GET_CASE, {
    variables: { id },
    skip: !id,
  });

  return {
    caseData: data?.case,
    loading,
    error,
    refetch,
  };
}
