'use client';

import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useQuery } from '@/hooks/useGraphQL';
import { apolloClient } from '@/lib/apollo-client';
import {
  GET_USER_PREFERENCES,
  GET_DEFAULT_RATES,
  GET_COURTS,
  GET_PERSONAL_CONTACTS,
  GET_SETTINGS_TEAM_MEMBERS,
  GET_PENDING_USERS,
} from '@/graphql/queries';
import {
  UPDATE_USER_PREFERENCES,
  UPDATE_DEFAULT_RATES,
  CREATE_COURT,
  UPDATE_COURT,
  DELETE_COURT,
  ADD_PERSONAL_CONTACT,
  REMOVE_PERSONAL_CONTACT,
  ACTIVATE_USER,
  DEACTIVATE_USER,
  UPDATE_TEAM_MEMBER_ROLE,
} from '@/graphql/mutations';

// Types
export interface UserPreferences {
  theme: 'DARK' | 'LIGHT';
  emailSignature: string | null;
  documentOpenMethod: 'DESKTOP' | 'ONLINE';
}

export interface DefaultRates {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

export interface Court {
  id: string;
  name: string;
  domains: string[];
  emails: string[];
  category: string;
  createdAt: string;
}

export interface PersonalContact {
  id: string;
  email: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
}

export interface PendingUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

// Generic hook result type
export interface HookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  backendPending: boolean;
  refetch: () => void;
}

// Mutation hook result type
export interface MutationResult<T> {
  mutate: (variables?: Record<string, unknown>) => Promise<T>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for user preferences - syncs with backend and local store
 */
export function useUserPreferences() {
  const localTheme = useSettingsStore((state) => state.theme);
  const setLocalTheme = useSettingsStore((state) => state.setTheme);

  const { data, loading, error, refetch } = useQuery<{ userPreferences: UserPreferences }>(
    GET_USER_PREFERENCES
  );

  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  const updatePreferences = useCallback(
    async (input: Partial<UserPreferences>) => {
      setUpdateLoading(true);
      setUpdateError(null);
      try {
        // Update local theme immediately for responsive UI
        if (input.theme) {
          setLocalTheme(input.theme.toLowerCase() as 'dark' | 'light');
        }

        const result = await apolloClient.mutate<{ updateUserPreferences: UserPreferences }>({
          mutation: UPDATE_USER_PREFERENCES,
          variables: { input },
        });
        await refetch();
        return result.data?.updateUserPreferences;
      } catch (err) {
        setUpdateError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setUpdateLoading(false);
      }
    },
    [refetch, setLocalTheme]
  );

  return {
    data: data?.userPreferences
      ? {
          theme: data.userPreferences.theme,
          emailSignature: data.userPreferences.emailSignature,
          documentOpenMethod: data.userPreferences.documentOpenMethod ?? 'ONLINE',
        }
      : {
          theme: localTheme.toUpperCase() as 'DARK' | 'LIGHT',
          emailSignature: null,
          documentOpenMethod: 'ONLINE' as const,
        },
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    updatePreferences,
    updateLoading,
    updateError,
  };
}

/**
 * Hook for default billing rates
 */
export function useDefaultRates() {
  const { data, loading, error, refetch } = useQuery<{ defaultRates: DefaultRates }>(
    GET_DEFAULT_RATES
  );

  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  const updateRates = useCallback(
    async (input: Partial<DefaultRates>) => {
      setUpdateLoading(true);
      setUpdateError(null);
      try {
        const result = await apolloClient.mutate<{ updateDefaultRates: DefaultRates }>({
          mutation: UPDATE_DEFAULT_RATES,
          variables: { input },
        });
        await refetch();
        return result.data?.updateDefaultRates;
      } catch (err) {
        setUpdateError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setUpdateLoading(false);
      }
    },
    [refetch]
  );

  return {
    data: data?.defaultRates || null,
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    updateRates,
    updateLoading,
    updateError,
  };
}

/**
 * Hook for courts (global email sources with category: Court)
 */
export function useCourts() {
  const { data, loading, error, refetch } = useQuery<{ globalEmailSources: Court[] }>(GET_COURTS);

  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const createCourt = useCallback(
    async (input: { name: string; domains: string[]; emails?: string[] }) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ createGlobalEmailSource: Court }>({
          mutation: CREATE_COURT,
          variables: { input: { ...input, category: 'Court' } },
        });
        await refetch();
        return result.data?.createGlobalEmailSource;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  const updateCourt = useCallback(
    async (id: string, input: Partial<{ name: string; domains: string[]; emails: string[] }>) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ updateGlobalEmailSource: Court }>({
          mutation: UPDATE_COURT,
          variables: { id, input },
        });
        await refetch();
        return result.data?.updateGlobalEmailSource;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  const deleteCourt = useCallback(
    async (id: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        await apolloClient.mutate({
          mutation: DELETE_COURT,
          variables: { id },
        });
        await refetch();
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  return {
    data: data?.globalEmailSources || [],
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    createCourt,
    updateCourt,
    deleteCourt,
    mutationLoading,
    mutationError,
  };
}

/**
 * Hook for personal email contacts
 */
export function usePersonalContacts() {
  const { data, loading, error, refetch } = useQuery<{ personalContacts: PersonalContact[] }>(
    GET_PERSONAL_CONTACTS
  );

  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const addContact = useCallback(
    async (email: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ addPersonalContact: PersonalContact }>({
          mutation: ADD_PERSONAL_CONTACT,
          variables: { email },
        });
        await refetch();
        return result.data?.addPersonalContact;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  const removeContact = useCallback(
    async (id: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        await apolloClient.mutate({
          mutation: REMOVE_PERSONAL_CONTACT,
          variables: { id },
        });
        await refetch();
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  return {
    data: data?.personalContacts || [],
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    addContact,
    removeContact,
    mutationLoading,
    mutationError,
  };
}

/**
 * Hook for team members (from MS Graph + local roles)
 */
export function useTeamMembers() {
  const { data, loading, error, refetch } = useQuery<{ teamMembers: TeamMember[] }>(
    GET_SETTINGS_TEAM_MEMBERS
  );

  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const updateRole = useCallback(
    async (userId: string, role: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ updateTeamMemberRole: TeamMember }>({
          mutation: UPDATE_TEAM_MEMBER_ROLE,
          variables: { input: { userId, role } },
        });
        await refetch();
        return result.data?.updateTeamMemberRole;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  const deactivateUser = useCallback(
    async (userId: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ deactivateUser: TeamMember }>({
          mutation: DEACTIVATE_USER,
          variables: { userId },
        });
        await refetch();
        return result.data?.deactivateUser;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  return {
    data: data?.teamMembers || [],
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    updateRole,
    deactivateUser,
    mutationLoading,
    mutationError,
  };
}

/**
 * Hook for pending users (org users not yet assigned)
 */
export function usePendingUsers() {
  const { data, loading, error, refetch } = useQuery<{ pendingUsers: PendingUser[] }>(
    GET_PENDING_USERS
  );

  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const activateUser = useCallback(
    async (userId: string, firmId: string, role: string) => {
      setMutationLoading(true);
      setMutationError(null);
      try {
        const result = await apolloClient.mutate<{ activateUser: TeamMember }>({
          mutation: ACTIVATE_USER,
          variables: { input: { userId, firmId, role } },
        });
        await refetch();
        return result.data?.activateUser;
      } catch (err) {
        setMutationError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setMutationLoading(false);
      }
    },
    [refetch]
  );

  return {
    data: data?.pendingUsers || [],
    loading,
    error: error || null,
    backendPending: false,
    refetch,
    activateUser,
    mutationLoading,
    mutationError,
  };
}

// Legacy exports for backwards compatibility
export function useFirmSettings(): HookResult<DefaultRates> {
  const { data, loading, error, refetch, backendPending } = useDefaultRates();
  return { data, loading, error: error || null, backendPending, refetch };
}

export function usePersonalEmails(): HookResult<PersonalContact[]> {
  const { data, loading, error, refetch, backendPending } = usePersonalContacts();
  return { data, loading, error: error || null, backendPending, refetch };
}

export function useTeamAccess(): HookResult<TeamMember[]> {
  const { data, loading, error, refetch, backendPending } = useTeamMembers();
  return { data, loading, error: error || null, backendPending, refetch };
}
