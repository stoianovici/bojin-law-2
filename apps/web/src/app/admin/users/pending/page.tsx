/**
 * Pending Users Page
 * Allows Partners to view and activate pending users
 * Story 2.4.1: Partner User Management
 */

'use client';

import { useState, useEffect } from 'react';
import { useRequireRole } from '../../../../hooks/useAuthorization';
import { getPendingUsers, activateUser } from '../../../../lib/services/userManagementApi';
import { getAllFirms, type Firm } from '../../../../lib/mockFirms';
import type { User, UserRole } from '@legal-platform/types';
import * as Dialog from '@radix-ui/react-dialog';

export default function PendingUsersPage() {
  const { authorized, isLoading: authLoading } = useRequireRole('Partner');
  const [users, setUsers] = useState<User[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Form state
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Paralegal');

  // Fetch pending users on mount
  useEffect(() => {
    if (authorized) {
      loadPendingUsers();
      setFirms(getAllFirms());
    }
  }, [authorized]);

  async function loadPendingUsers() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getPendingUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load pending users:', err);
      setError('Failed to load pending users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function openActivationModal(user: User) {
    setSelectedUser(user);
    setSelectedFirmId(firms[0]?.id || '');
    setSelectedRole('Paralegal');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedUser(null);
    setSelectedFirmId('');
    setSelectedRole('Paralegal');
  }

  async function handleActivate() {
    if (!selectedUser || !selectedFirmId) {
      return;
    }

    try {
      setIsActivating(true);
      await activateUser(selectedUser.id, selectedFirmId, selectedRole);

      // Show success toast
      setToastMessage(
        `User ${selectedUser.firstName} ${selectedUser.lastName} has been activated successfully.`
      );
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Close modal and refresh list
      closeModal();
      await loadPendingUsers();
    } catch (err) {
      console.error('Failed to activate user:', err);
      setToastMessage('Failed to activate user. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsActivating(false);
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
          Pending Users
        </h1>
        <p className="text-gray-600">
          Review and activate new users awaiting access to the platform
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading pending users...</div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No pending users at this time.</p>
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
                  Azure AD ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {user.azureAdId.substring(0, 16)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('ro-RO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openActivationModal(user)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    >
                      Activate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activation Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Activate User
            </Dialog.Title>

            {selectedUser && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-1">Activating:</p>
                <p className="font-medium text-gray-900">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
                <p className="text-sm text-gray-600">{selectedUser.email}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label
                  htmlFor="firm-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Assign to Firm
                </label>
                <select
                  id="firm-select"
                  value={selectedFirmId}
                  onChange={(e) => setSelectedFirmId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isActivating}
                >
                  {firms.map((firm) => (
                    <option key={firm.id} value={firm.id}>
                      {firm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="role-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Assign Role
                </label>
                <select
                  id="role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isActivating}
                >
                  <option value="Paralegal">Paralegal</option>
                  <option value="Associate">Associate</option>
                  <option value="Partner">Partner</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={isActivating}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={isActivating || !selectedFirmId}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isActivating ? 'Activating...' : 'Activate User'}
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
