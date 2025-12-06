/**
 * User Skills React Hooks
 * Story 4.5: Team Workload Management
 *
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import type { UserSkill, SkillType } from '@legal-platform/types';

// GraphQL Operations
const SKILL_FRAGMENT = gql`
  fragment SkillFields on UserSkill {
    id
    userId
    skillType
    proficiency
    verified
  }
`;

const GET_MY_SKILLS = gql`
  ${SKILL_FRAGMENT}
  query GetMySkills {
    mySkills {
      ...SkillFields
    }
  }
`;

const GET_USER_SKILLS = gql`
  ${SKILL_FRAGMENT}
  query GetUserSkills($userId: ID!) {
    userSkills(userId: $userId) {
      ...SkillFields
    }
  }
`;

const UPDATE_MY_SKILLS = gql`
  ${SKILL_FRAGMENT}
  mutation UpdateMySkills($skills: [UserSkillInput!]!) {
    updateMySkills(skills: $skills) {
      ...SkillFields
    }
  }
`;

const VERIFY_USER_SKILL = gql`
  ${SKILL_FRAGMENT}
  mutation VerifyUserSkill($skillId: ID!) {
    verifyUserSkill(skillId: $skillId) {
      ...SkillFields
    }
  }
`;

interface UserSkillInput {
  skillType: SkillType;
  proficiency: number;
}

/**
 * Hook to get current user's skills
 */
export function useMySkills() {
  return useQuery<{ mySkills: UserSkill[] }>(GET_MY_SKILLS);
}

/**
 * Hook to get a specific user's skills
 */
export function useUserSkills(userId: string) {
  return useQuery<{ userSkills: UserSkill[] }>(GET_USER_SKILLS, {
    variables: { userId },
    skip: !userId,
  });
}

/**
 * Hook to update current user's skills
 */
export function useUpdateMySkills() {
  return useMutation<{ updateMySkills: UserSkill[] }, { skills: UserSkillInput[] }>(
    UPDATE_MY_SKILLS,
    {
      refetchQueries: ['GetMySkills'],
    }
  );
}

/**
 * Hook to verify a user's skill (Partner only)
 */
export function useVerifyUserSkill() {
  return useMutation<{ verifyUserSkill: UserSkill }, { skillId: string }>(VERIFY_USER_SKILL, {
    refetchQueries: ['GetUserSkills', 'GetMySkills'],
  });
}
