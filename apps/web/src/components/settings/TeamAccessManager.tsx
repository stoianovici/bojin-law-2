'use client';

import { useState } from 'react';
import { Plus, Users, Loader2, UserMinus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeamMembers, usePendingUsers } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';

const ROLES = [
  { value: 'Partner', label: 'Partener' },
  { value: 'Associate', label: 'Asociat' },
  { value: 'AssociateJr', label: 'Asociat Jr' },
  { value: 'BusinessOwner', label: 'Administrator' },
];

export function TeamAccessManager() {
  const { user } = useAuth();
  const {
    data: members,
    loading,
    updateRole,
    deactivateUser,
    mutationLoading,
    mutationError,
  } = useTeamMembers();
  const { data: pendingUsers, activateUser, mutationLoading: activateLoading } = usePendingUsers();
  const [showPending, setShowPending] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole(userId, newRole);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Sigur doriți să dezactivați acest utilizator?')) return;
    try {
      await deactivateUser(userId);
    } catch (err) {
      console.error('Failed to deactivate user:', err);
    }
  };

  const handleActivate = async (userId: string) => {
    const role = selectedRole[userId] || 'Associate';
    if (!user?.firmId) return;
    try {
      await activateUser(userId, user.firmId, role);
      setSelectedRole((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (err) {
      console.error('Failed to activate user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-linear-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info text */}
      <p className="text-sm text-linear-text-secondary">
        Controlează care utilizatori Azure AD pot accesa această aplicație
      </p>

      {/* Error message */}
      {mutationError && <p className="text-sm text-red-500">{mutationError.message}</p>}

      {/* Active members table */}
      <div className="border border-linear-border-subtle rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-linear-bg-tertiary">
            <tr>
              <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                Nume
              </th>
              <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                Email
              </th>
              <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                Rol
              </th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {members && members.length > 0 ? (
              members.map((member) => (
                <tr key={member.id} className="border-t border-linear-border-subtle">
                  <td className="px-4 py-3 text-sm text-linear-text-primary">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-linear-text-secondary">{member.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={mutationLoading || member.id === user?.id}
                      className="text-sm bg-linear-bg-tertiary border border-linear-border-subtle rounded px-2 py-1 text-linear-text-primary"
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {member.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(member.id)}
                        disabled={mutationLoading}
                      >
                        <UserMinus className="h-4 w-4 text-linear-text-muted hover:text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-8 text-linear-text-muted">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nu există membri în echipă configurați</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pending users section */}
      {pendingUsers && pendingUsers.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPending(!showPending)}
            className="flex items-center gap-2 text-sm text-linear-text-secondary hover:text-linear-text-primary"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showPending ? 'rotate-180' : ''}`}
            />
            {pendingUsers.length} utilizatori în așteptare
          </button>

          {showPending && (
            <div className="border border-linear-border-subtle rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-linear-bg-tertiary">
                  <tr>
                    <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                      Nume
                    </th>
                    <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                      Email
                    </th>
                    <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                      Rol
                    </th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((pending) => (
                    <tr key={pending.id} className="border-t border-linear-border-subtle">
                      <td className="px-4 py-3 text-sm text-linear-text-primary">
                        {pending.firstName} {pending.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-linear-text-secondary">
                        {pending.email}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedRole[pending.id] || 'Associate'}
                          onChange={(e) =>
                            setSelectedRole({ ...selectedRole, [pending.id]: e.target.value })
                          }
                          disabled={activateLoading}
                          className="text-sm bg-linear-bg-tertiary border border-linear-border-subtle rounded px-2 py-1 text-linear-text-primary"
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => handleActivate(pending.id)}
                          disabled={activateLoading}
                        >
                          {activateLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Activează'
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info about adding users */}
      <div className="flex items-center gap-2 text-sm text-linear-text-muted">
        <Plus className="h-4 w-4" />
        <span>Pentru a adăuga utilizatori noi, invitați-i în tenant-ul Azure AD</span>
      </div>
    </div>
  );
}
