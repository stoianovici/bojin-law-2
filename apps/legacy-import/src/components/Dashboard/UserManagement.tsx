'use client';

/**
 * User Management Component
 * Allows Partners to view and manage user roles within their firm
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  UserCog,
} from 'lucide-react';

type UserRole = 'Partner' | 'Associate' | 'Paralegal' | 'Admin';
type UserStatus = 'Active' | 'Pending' | 'Inactive';

interface FirmUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string | null;
  createdAt: string;
}

interface UserManagementProps {
  currentUserId: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'Partner',
    label: 'Partener',
    description: 'Acces complet - încărcare PST, export, administrare',
  },
  {
    value: 'Associate',
    label: 'Asociat',
    description: 'Categorizare documente în loturile atribuite',
  },
  {
    value: 'Paralegal',
    label: 'Asociat Jr.',
    description: 'Categorizare documente în loturile atribuite',
  },
  { value: 'Admin', label: 'Administrator', description: 'Acces complet la administrare' },
];

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: 'Active', label: 'Activ', color: 'bg-green-100 text-green-700' },
  { value: 'Pending', label: 'În așteptare', color: 'bg-amber-100 text-amber-700' },
  { value: 'Inactive', label: 'Inactiv', color: 'bg-gray-100 text-gray-600' },
];

export function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<FirmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/users');
      if (!res.ok) {
        throw new Error('Nu s-au putut încărca utilizatorii');
      }
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la încărcarea utilizatorilor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentUserId && newRole !== 'Partner') {
      setError('Nu îți poți schimba propriul rol de Partener');
      return;
    }

    try {
      setUpdating(userId);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch('/api/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Nu s-a putut actualiza rolul');
      }

      // Update local state
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setSuccessMessage('Rol actualizat cu succes');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la actualizarea rolului');
    } finally {
      setUpdating(null);
      setOpenDropdown(null);
    }
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    if (userId === currentUserId) {
      setError('Nu îți poți schimba propriul status');
      return;
    }

    try {
      setUpdating(userId);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch('/api/users/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Nu s-a putut actualiza statusul');
      }

      // Update local state
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
      setSuccessMessage('Status actualizat cu succes');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la actualizarea statusului');
    } finally {
      setUpdating(null);
      setOpenDropdown(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Niciodată';
    return new Date(dateString).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleLabel = (role: UserRole) => {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  };

  const getStatusConfig = (status: UserStatus) => {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Se încarcă utilizatorii...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Administrare utilizatori</h3>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          title="Reîmprospătează"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="h-4 w-4" />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Users Table */}
      {users.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Nu există utilizatori în firmă.</p>
      ) : (
        <div className="overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-medium text-gray-600">Utilizator</th>
                <th className="text-left py-3 px-3 font-medium text-gray-600">Rol</th>
                <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-3 font-medium text-gray-600">Ultima activitate</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const statusConfig = getStatusConfig(user.status);

                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {/* User Info */}
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-600">(tu)</span>
                          )}
                        </p>
                        <p className="text-gray-500 text-xs">{user.email}</p>
                      </div>
                    </td>

                    {/* Role Dropdown */}
                    <td className="py-3 px-3">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenDropdown(
                              openDropdown === `role-${user.id}` ? null : `role-${user.id}`
                            )
                          }
                          disabled={updating === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {updating === user.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Shield className="h-3 w-3 text-gray-500" />
                          )}
                          <span className="text-gray-700">{getRoleLabel(user.role)}</span>
                          <ChevronDown className="h-3 w-3 text-gray-400" />
                        </button>

                        {openDropdown === `role-${user.id}` && (
                          <div className="absolute z-50 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            {ROLE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => updateUserRole(user.id, option.value)}
                                disabled={isCurrentUser && option.value !== 'Partner'}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                                  user.role === option.value ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-900">{option.label}</span>
                                  {user.role === option.value && (
                                    <Check className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3 px-3">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenDropdown(
                              openDropdown === `status-${user.id}` ? null : `status-${user.id}`
                            )
                          }
                          disabled={updating === user.id || isCurrentUser}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color} ${
                            !isCurrentUser ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                          } disabled:opacity-50`}
                        >
                          {statusConfig.label}
                          {!isCurrentUser && <ChevronDown className="h-3 w-3 inline ml-1" />}
                        </button>

                        {openDropdown === `status-${user.id}` && !isCurrentUser && (
                          <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => updateUserStatus(user.id, option.value)}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                                  user.status === option.value ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${option.color}`}
                                  >
                                    {option.label}
                                  </span>
                                  {user.status === option.value && (
                                    <Check className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {formatDate(user.lastActive)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Users className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Despre roluri</h4>
            <ul className="mt-2 text-sm text-blue-700 space-y-1">
              <li>
                <strong>Partener:</strong> Poate încărca PST-uri, administra categorii, exporta în
                OneDrive și administra utilizatori
              </li>
              <li>
                <strong>Asociat/Asociat Jr.:</strong> Poate categoriza documentele din loturile
                atribuite
              </li>
              <li>
                <strong>Administrator:</strong> Acces complet la administrare (similar Partenerului)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
