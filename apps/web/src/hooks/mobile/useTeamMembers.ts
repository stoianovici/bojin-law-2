'use client';

import { useQuery } from '@apollo/client/react';
import { GET_TEAM_MEMBERS } from '@/graphql/queries';

// =============================================================================
// Types
// =============================================================================

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'LAWYER' | 'PARALEGAL';
  avatarUrl: string | null;
}

interface GetTeamMembersData {
  firmUsers: TeamMember[];
}

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm1',
    firstName: 'Alexandru',
    lastName: 'Popa',
    email: 'alexandru.popa@bojin.ro',
    role: 'ADMIN',
    avatarUrl: null,
  },
  {
    id: 'tm2',
    firstName: 'Elena',
    lastName: 'Dumitrescu',
    email: 'elena.d@bojin.ro',
    role: 'LAWYER',
    avatarUrl: null,
  },
  {
    id: 'tm3',
    firstName: 'Mihai',
    lastName: 'Ionescu',
    email: 'mihai.i@bojin.ro',
    role: 'LAWYER',
    avatarUrl: null,
  },
  {
    id: 'tm4',
    firstName: 'Ana',
    lastName: 'Marin',
    email: 'ana.m@bojin.ro',
    role: 'PARALEGAL',
    avatarUrl: null,
  },
  {
    id: 'tm5',
    firstName: 'Cristian',
    lastName: 'Stanescu',
    email: 'cristian.s@bojin.ro',
    role: 'LAWYER',
    avatarUrl: null,
  },
  {
    id: 'tm6',
    firstName: 'Diana',
    lastName: 'Radu',
    email: 'diana.r@bojin.ro',
    role: 'PARALEGAL',
    avatarUrl: null,
  },
];

// =============================================================================
// Hook
// =============================================================================

export function useTeamMembers() {
  const { data, loading, error } = useQuery<GetTeamMembersData>(GET_TEAM_MEMBERS, {
    fetchPolicy: 'cache-and-network',
  });

  // Use mock data as fallback when no data is available
  const members = data?.firmUsers ?? MOCK_TEAM_MEMBERS;

  return {
    members,
    loading,
    error,
  };
}
