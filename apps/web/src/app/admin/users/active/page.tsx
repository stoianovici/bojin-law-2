/**
 * Active Users Management Page
 * Allows Partners to view, update roles, and deactivate active users
 * Story 2.4.1: Partner User Management
 */

'use client';

import { useState, useEffect } from 'react';
import { useRequireRole } from '../../../../hooks/useAuthorization';
import {
  getActiveUsers,
  updateUserRole,
  deactivateUser,
} from '../../../../lib/services/userManagementApi';
import { getFirmById } from '../../../../lib/mockFirms';
import { useAuth } from '../../../../lib/hooks/useAuth';
import type { User, UserRole } from '@legal-platform/types';
import * as Dialog from '@radix-ui/react-dialog';

export default function ActiveUsersPage() {
  const { authorized, isLoading: authLoading } = useRequireRole('Partner');
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deactivation modal state
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Fetch active users on mount
  useEffect(() => {
    if (authorized && currentUser) {
      loadActiveUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, currentUser]);

  async function loadActiveUsers() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getActiveUsers(currentUser?.firmId || undefined);
      setUsers(data);
    } catch (err) {
      console.error('Failed to load active users:', err);
      setError('Failed to load active users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    try {
      await updateUserRole(userId, newRole);

      // Show success toast
      setToastMessage('User role updated successfully.');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh list
      await loadActiveUsers();
    } catch (err) {
      console.error('Failed to update user role:', err);
      setToastMessage('Failed to update user role. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function openDeactivationModal(user: User) {
    setUserToDeactivate(user);
  }

  function closeDeactivationModal() {
    setUserToDeactivate(null);
  }

  async function handleDeactivate() {
    if (!userToDeactivate) {
      return;
    }

    try {
      setIsDeactivating(true);
      await deactivateUser(userToDeactivate.id);

      // Show success toast
      setToastMessage(
        `User ${userToDeactivate.firstName} ${userToDeactivate.lastName} has been deactivated.`
      );
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Close modal and refresh list
      closeDeactivationModal();
      await loadActiveUsers();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      setToastMessage('Failed to deactivate user. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsDeactivating(false);
    }
  }

  // Show loading spinner while checking authorization
  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Active Users
        </h1>
        <p className="text-gray-600">
          Manage roles and access for active users in your firm
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading active users...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No active users found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as UserRole)
                      }
                      className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Paralegal">Paralegal</option>
                      <option value="Associate">Associate</option>
                      <option value="Partner">Partner</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {user.firmId
                      ? getFirmById(user.firmId)?.name || user.firmId
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.lastActive).toLocaleDateString('ro-RO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openDeactivationModal(user)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      <Dialog.Root
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && closeDeactivationModal()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Confirm Deactivation
            </Dialog.Title>

            {userToDeactivate && (
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to deactivate this user?
                </p>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="font-medium text-gray-900">
                    {userToDeactivate.firstName} {userToDeactivate.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userToDeactivate.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    Role: {userToDeactivate.role}
                  </p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  This user will lose access to the platform and can only be
                  reactivated by a Partner.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeactivationModal}
                disabled={isDeactivating}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate User'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast Notification */}
      {showToast && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white ${
            toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
