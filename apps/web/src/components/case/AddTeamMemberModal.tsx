/**
 * Add Team Member Modal
 * Modal for adding a team member to a case with user selection dropdown
 */

'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useTeamAssign } from '../../hooks/useTeamAssign';
import { useFirmUsers } from '../../hooks/useFirmUsers';

// ============================================================================
// Types
// ============================================================================

export interface AddTeamMemberModalProps {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_OPTIONS = [
  { value: 'Lead', label: 'Lead' },
  { value: 'Support', label: 'Support' },
  { value: 'Observer', label: 'Observer' },
];

// ============================================================================
// Component
// ============================================================================

export function AddTeamMemberModal({ caseId, open, onOpenChange }: AddTeamMemberModalProps) {
  const { assignTeam, loading } = useTeamAssign();
  const { users, loading: usersLoading } = useFirmUsers();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('Support');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      return;
    }

    try {
      await assignTeam({
        caseId,
        userId: selectedUserId,
        role,
      });
      // Reset form and close modal on success
      setSelectedUserId('');
      setRole('Support');
      onOpenChange(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setSelectedUserId('');
      setRole('Support');
    }
    onOpenChange(newOpen);
  };

  // Get display name for selected user
  const selectedUser = users.find((u: { id: string }) => u.id === selectedUserId);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-linear-bg-elevated rounded-lg shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto focus:outline-none z-50">
          <Dialog.Title className="text-xl font-semibold text-linear-text-primary mb-4">
            Adaugă Membru în Echipă
          </Dialog.Title>

          <Dialog.Description className="text-sm text-linear-text-secondary mb-6">
            Selectați un utilizator pentru a-l adăuga la echipa dosarului.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Selection */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-linear-text-secondary mb-1">
                Utilizator <span className="text-linear-error">*</span>
              </label>
              <select
                id="userId"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-linear-border rounded-lg focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent bg-linear-bg-secondary text-linear-text-primary"
                required
                disabled={loading || usersLoading}
              >
                <option value="">
                  {usersLoading ? 'Se încarcă...' : 'Selectați un utilizator'}
                </option>
                {users.map(
                  (user: { id: string; lastName: string; firstName: string; role: string }) => (
                    <option key={user.id} value={user.id}>
                      {user.lastName} {user.firstName} ({user.role})
                    </option>
                  )
                )}
              </select>
              {selectedUser && <p className="text-xs text-linear-text-tertiary mt-1">{selectedUser.email}</p>}
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-linear-text-secondary mb-1">
                Rol <span className="text-linear-error">*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-linear-border rounded-lg focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent bg-linear-bg-secondary text-linear-text-primary"
                required
                disabled={loading}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-linear-border-subtle">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary rounded-lg hover:bg-linear-bg-hover transition-colors"
                  disabled={loading}
                >
                  Anulează
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-lg hover:bg-linear-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading || !selectedUserId}
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Adaugă Membru
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 text-linear-text-muted hover:text-linear-text-secondary transition-colors"
              aria-label="Închide"
            >
              <Cross2Icon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

AddTeamMemberModal.displayName = 'AddTeamMemberModal';
