/**
 * User Management Page
 * Allows Partners to view all users, activate pending users, and manage roles
 * Story 2.4.1: Partner User Management
 */

'use client';

import { useState, useEffect } from 'react';
import { useRequireRole } from '../../../../hooks/useAuthorization';
import {
  getPendingUsers,
  getActiveUsers,
  activateUser,
  updateUserRole,
  deactivateUser,
} from '../../../../lib/services/userManagementApi';
import { useAuth } from '../../../../lib/hooks/useAuth';
import type { User, UserRole } from '@legal-platform/types';
import * as Dialog from '@radix-ui/react-dialog';

type UserWithActions = User & { isPending: boolean };

export default function UserManagementPage() {
  const { authorized, isLoading: authLoading } = useRequireRole('Partner');
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithActions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activation modal state
  const [userToActivate, setUserToActivate] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Paralegal');
  const [isActivating, setIsActivating] = useState(false);

  // Deactivation modal state
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Filter state
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');

  // Fetch all users on mount
  useEffect(() => {
    if (authorized && currentUser) {
      loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, currentUser]);

  async function loadAllUsers() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both pending and active users in parallel
      const [pendingData, activeData] = await Promise.all([
        getPendingUsers(),
        getActiveUsers(currentUser?.firmId || undefined),
      ]);

      // Combine and mark users
      const allUsers: UserWithActions[] = [
        ...pendingData.map((u) => ({ ...u, isPending: true })),
        ...activeData.map((u) => ({ ...u, isPending: false })),
      ];

      // Sort: pending first, then by name
      allUsers.sort((a, b) => {
        if (a.isPending && !b.isPending) return -1;
        if (!a.isPending && b.isPending) return 1;
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      });

      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function showToastMessage(message: string, type: 'success' | 'error') {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  // Activation handlers
  function openActivationModal(user: User) {
    setUserToActivate(user);
    setSelectedRole('Paralegal');
  }

  function closeActivationModal() {
    setUserToActivate(null);
    setSelectedRole('Paralegal');
  }

  async function handleActivate() {
    if (!userToActivate || !currentUser?.firmId) return;

    try {
      setIsActivating(true);
      await activateUser(userToActivate.id, currentUser.firmId, selectedRole);
      showToastMessage(
        `${userToActivate.firstName} ${userToActivate.lastName} has been activated as ${selectedRole}.`,
        'success'
      );
      closeActivationModal();
      await loadAllUsers();
    } catch (err) {
      console.error('Failed to activate user:', err);
      showToastMessage('Failed to activate user. Please try again.', 'error');
    } finally {
      setIsActivating(false);
    }
  }

  // Role change handler
  async function handleRoleChange(userId: string, newRole: UserRole) {
    try {
      await updateUserRole(userId, newRole);
      showToastMessage('User role updated successfully.', 'success');
      await loadAllUsers();
    } catch (err) {
      console.error('Failed to update user role:', err);
      showToastMessage('Failed to update user role. Please try again.', 'error');
    }
  }

  // Deactivation handlers
  function openDeactivationModal(user: User) {
    setUserToDeactivate(user);
  }

  function closeDeactivationModal() {
    setUserToDeactivate(null);
  }

  async function handleDeactivate() {
    if (!userToDeactivate) return;

    try {
      setIsDeactivating(true);
      await deactivateUser(userToDeactivate.id);
      showToastMessage(
        `${userToDeactivate.firstName} ${userToDeactivate.lastName} has been deactivated.`,
        'success'
      );
      closeDeactivationModal();
      await loadAllUsers();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      showToastMessage('Failed to deactivate user. Please try again.', 'error');
    } finally {
      setIsDeactivating(false);
    }
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    if (filter === 'pending') return user.isPending;
    if (filter === 'active') return !user.isPending;
    return true;
  });

  const pendingCount = users.filter((u) => u.isPending).length;
  const activeCount = users.filter((u) => !u.isPending).length;

  // Show loading spinner while checking authorization
  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Se încarcă...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestionare Utilizatori</h1>
        <p className="text-gray-600">Gestionați utilizatorii, rolurile și accesul la platformă</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Toți Utilizatorii ({users.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          În Așteptare ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Activi ({activeCount})
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Se încarcă utilizatorii...</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">
            {filter === 'pending'
              ? 'Nu există utilizatori în așteptare momentan.'
              : filter === 'active'
                ? 'Nu există utilizatori activi.'
                : 'Nu s-au găsit utilizatori.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nume
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stare
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ultima Activitate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.isPending ? (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        În Așteptare
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Activ
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.isPending ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        disabled={user.id === currentUser?.id}
                        className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="Paralegal">Asociat Jr.</option>
                        <option value="Associate">Asociat</option>
                        <option value="Partner">Partener</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.lastActive).toLocaleDateString('ro-RO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {user.isPending ? (
                      <button
                        onClick={() => openActivationModal(user)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                      >
                        Activează
                      </button>
                    ) : user.id !== currentUser?.id ? (
                      <button
                        onClick={() => openDeactivationModal(user)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Dezactivează
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Tu</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activation Modal */}
      <Dialog.Root open={!!userToActivate} onOpenChange={(open) => !open && closeActivationModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Activează Utilizator
            </Dialog.Title>

            {userToActivate && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-1">Se activează:</p>
                <p className="font-medium text-gray-900">
                  {userToActivate.firstName} {userToActivate.lastName}
                </p>
                <p className="text-sm text-gray-600">{userToActivate.email}</p>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-2">
                Atribuie Rol
              </label>
              <select
                id="role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isActivating}
              >
                <option value="Paralegal">Asociat Jr.</option>
                <option value="Associate">Asociat</option>
                <option value="Partner">Partener</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeActivationModal}
                disabled={isActivating}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                Anulează
              </button>
              <button
                onClick={handleActivate}
                disabled={isActivating}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isActivating ? 'Se activează...' : 'Activează Utilizator'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Deactivation Modal */}
      <Dialog.Root
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && closeDeactivationModal()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Confirmă Dezactivarea
            </Dialog.Title>

            {userToDeactivate && (
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Sunteți sigur că doriți să dezactivați acest utilizator?
                </p>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="font-medium text-gray-900">
                    {userToDeactivate.firstName} {userToDeactivate.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{userToDeactivate.email}</p>
                  <p className="text-sm text-gray-600">Rol: {userToDeactivate.role}</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Acest utilizator va pierde accesul la platformă.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeactivationModal}
                disabled={isDeactivating}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                Anulează
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeactivating ? 'Se dezactivează...' : 'Dezactivează Utilizator'}
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
