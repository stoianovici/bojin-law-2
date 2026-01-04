/**
 * User Management API Client
 * Provides methods for managing users (activation, deactivation, role changes)
 * Story 2.4.1: Partner User Management
 */

import { apiClient } from '../api-client';
import type { User, UserRole } from '@legal-platform/types';

/**
 * Get all pending users awaiting activation
 */
export async function getPendingUsers(): Promise<User[]> {
  return apiClient.get<User[]>('/api/users/pending');
}

/**
 * Get all active users in the partner's firm
 */
export async function getActiveUsers(firmId?: string): Promise<User[]> {
  const query = firmId ? `?firmId=${firmId}` : '';
  return apiClient.get<User[]>(`/api/users/active${query}`);
}

/**
 * Activate a pending user by assigning them to a firm with a role
 */
export async function activateUser(userId: string, firmId: string, role: UserRole): Promise<User> {
  return apiClient.post<User>(`/api/users/${userId}/activate`, {
    firmId,
    role,
  });
}

/**
 * Deactivate an active user
 */
export async function deactivateUser(userId: string): Promise<User> {
  return apiClient.post<User>(`/api/users/${userId}/deactivate`);
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  return apiClient.patch<User>(`/api/users/${userId}/role`, {
    role,
  });
}
