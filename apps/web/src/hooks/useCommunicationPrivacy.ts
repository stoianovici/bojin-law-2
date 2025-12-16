/**
 * Communication Privacy React Hooks
 * Story 5.5: Multi-Channel Communication Hub (AC: 6)
 *
 * Provides hooks for managing communication privacy controls
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Operations
// ============================================================================

const TIMELINE_ENTRY_PRIVACY_FRAGMENT = gql`
  fragment TimelineEntryPrivacyFields on TimelineEntry {
    id
    isPrivate
    privacyLevel
  }
`;

const UPDATE_PRIVACY = gql`
  ${TIMELINE_ENTRY_PRIVACY_FRAGMENT}
  mutation UpdateCommunicationPrivacy($input: UpdatePrivacyInput!) {
    updateCommunicationPrivacy(input: $input) {
      ...TimelineEntryPrivacyFields
    }
  }
`;

const GET_CASE_TEAM_MEMBERS = gql`
  query GetCaseTeamMembers($caseId: ID!) {
    case(id: $caseId) {
      id
      team {
        id
        firstName
        lastName
        email
        role
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type PrivacyLevel = 'Normal' | 'Confidential' | 'AttorneyOnly' | 'PartnerOnly';

export interface UpdatePrivacyInput {
  communicationId: string;
  privacyLevel: PrivacyLevel;
  allowedViewers?: string[];
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface PrivacyConfig {
  level: PrivacyLevel;
  label: string;
  description: string;
  icon: string;
  color: string;
  requiredRole?: string[];
  requiresViewerSelection?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for updating communication privacy
 */
export function useUpdatePrivacy() {
  const [updateMutation, { loading, error }] = useMutation(UPDATE_PRIVACY);

  const updatePrivacy = useCallback(
    async (input: UpdatePrivacyInput) => {
      const result = await updateMutation({
        variables: { input },
      });

      return result.data?.updateCommunicationPrivacy;
    },
    [updateMutation]
  );

  return {
    updatePrivacy,
    loading,
    error,
  };
}

/**
 * Hook for getting team members for viewer selection
 */
export function useTeamMembers(caseId: string) {
  const { data, loading, error, refetch } = useQuery(GET_CASE_TEAM_MEMBERS, {
    variables: { caseId },
    skip: !caseId,
  });

  const teamMembers: TeamMember[] = data?.case?.team || [];

  // Filter by role for certain privacy levels
  const getEligibleViewers = useCallback(
    (privacyLevel: PrivacyLevel): TeamMember[] => {
      switch (privacyLevel) {
        case 'AttorneyOnly':
          return teamMembers.filter((m) => ['Partner', 'Associate'].includes(m.role));
        case 'PartnerOnly':
          return teamMembers.filter((m) => m.role === 'Partner');
        default:
          return teamMembers;
      }
    },
    [teamMembers]
  );

  return {
    teamMembers,
    loading,
    error,
    refetch,
    getEligibleViewers,
  };
}

/**
 * Utility hook for privacy level configurations
 */
export function usePrivacyLevels() {
  const levels: PrivacyConfig[] = [
    {
      level: 'Normal',
      label: 'Normal',
      description: 'Visible to all case team members',
      icon: '👥',
      color: 'bg-gray-100 text-gray-700',
    },
    {
      level: 'Confidential',
      label: 'Confidential',
      description: 'Visible to specified users only',
      icon: '🔒',
      color: 'bg-yellow-100 text-yellow-700',
      requiresViewerSelection: true,
    },
    {
      level: 'AttorneyOnly',
      label: 'Attorney Only',
      description: 'Visible to Partners and Associates only',
      icon: '⚖️',
      color: 'bg-orange-100 text-orange-700',
      requiredRole: ['Partner', 'Associate'],
    },
    {
      level: 'PartnerOnly',
      label: 'Partner Only',
      description: 'Visible to Partners only',
      icon: '👑',
      color: 'bg-red-100 text-red-700',
      requiredRole: ['Partner'],
    },
  ];

  const getLevelConfig = useCallback((level: PrivacyLevel): PrivacyConfig | undefined => {
    return levels.find((l) => l.level === level);
  }, []);

  const getLevelLabel = useCallback(
    (level: PrivacyLevel): string => {
      return getLevelConfig(level)?.label || level;
    },
    [getLevelConfig]
  );

  const getLevelDescription = useCallback(
    (level: PrivacyLevel): string => {
      return getLevelConfig(level)?.description || '';
    },
    [getLevelConfig]
  );

  const getLevelColor = useCallback(
    (level: PrivacyLevel): string => {
      return getLevelConfig(level)?.color || 'bg-gray-100 text-gray-700';
    },
    [getLevelConfig]
  );

  const getLevelIcon = useCallback(
    (level: PrivacyLevel): string => {
      return getLevelConfig(level)?.icon || '👥';
    },
    [getLevelConfig]
  );

  const requiresViewerSelection = useCallback(
    (level: PrivacyLevel): boolean => {
      return getLevelConfig(level)?.requiresViewerSelection || false;
    },
    [getLevelConfig]
  );

  const canUserSetPrivacy = useCallback((userRole: string, targetLevel: PrivacyLevel): boolean => {
    // Only Partners can set Partner-only
    if (targetLevel === 'PartnerOnly' && userRole !== 'Partner') {
      return false;
    }

    // Only attorneys can set Attorney-only
    if (targetLevel === 'AttorneyOnly' && !['Partner', 'Associate'].includes(userRole)) {
      return false;
    }

    return true;
  }, []);

  const getAvailableLevels = useCallback(
    (userRole: string): PrivacyConfig[] => {
      return levels.filter((level) => canUserSetPrivacy(userRole, level.level));
    },
    [canUserSetPrivacy]
  );

  return {
    levels,
    getLevelConfig,
    getLevelLabel,
    getLevelDescription,
    getLevelColor,
    getLevelIcon,
    requiresViewerSelection,
    canUserSetPrivacy,
    getAvailableLevels,
  };
}

/**
 * Check if user can view a communication based on privacy settings
 */
export function canViewCommunication(
  userRole: string,
  userId: string,
  privacyLevel: PrivacyLevel,
  allowedViewers?: string[]
): boolean {
  switch (privacyLevel) {
    case 'Normal':
      return true;

    case 'Confidential':
      return allowedViewers?.includes(userId) || false;

    case 'AttorneyOnly':
      return ['Partner', 'Associate'].includes(userRole);

    case 'PartnerOnly':
      return userRole === 'Partner';

    default:
      return false;
  }
}
