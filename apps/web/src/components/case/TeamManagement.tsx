/**
 * Team Management Component
 * Story 2.8: Case CRUD Operations UI - Task 12
 *
 * Manages case team member assignments with add/remove functionality
 */

'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Cross2Icon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { useTeamAssign } from '../../hooks/useTeamAssign';
import { useTeamRemove } from '../../hooks/useTeamRemove';
import type { UserRole } from '@legal-platform/types';

interface CaseTeamMember {
  id: string;
  userId: string;
  role: string;
  assignedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface TeamManagementProps {
  caseId: string;
  teamMembers: CaseTeamMember[];
  currentUserRole?: UserRole;
}

/**
 * Format date helper
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Add Team Member Modal Component
 */
function AddTeamMemberModal({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { assignTeam, loading } = useTeamAssign();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('Support');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      return;
    }

    try {
      await assignTeam({
        caseId,
        userId: userId.trim(),
        role,
      });
      // Reset form and close modal on success
      setUserId('');
      setRole('Support');
      onOpenChange(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto focus:outline-none">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
            Add Team Member
          </Dialog.Title>

          <Dialog.Description className="text-sm text-gray-600 mb-6">
            Assign a user to this case team with a specific role.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User ID Input (temporary workaround - no users query available) */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                User ID <span className="text-red-500">*</span>
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user UUID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the UUID of the user to assign to this case.
              </p>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="Lead">Lead</option>
                <option value="Support">Support</option>
                <option value="Observer">Observer</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !userId.trim()}
              >
                {loading ? 'Assigning...' : 'Add Team Member'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <Cross2Icon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Remove Team Member Confirmation Dialog
 */
function RemoveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  memberName,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  memberName: string;
  loading: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none">
          <AlertDialog.Title className="text-xl font-semibold text-gray-900 mb-2">
            Remove Team Member
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-6">
            Are you sure you want to remove <strong>{memberName}</strong> from this case team?
            This action cannot be undone.
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Main Team Management Component
 */
export function TeamManagement({ caseId, teamMembers, currentUserRole }: TeamManagementProps) {
  const { removeTeamMember, loading: removing } = useTeamRemove();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CaseTeamMember | null>(null);

  // Count Lead members to enforce "cannot remove last Lead" rule
  const leadCount = teamMembers.filter((m) => m.role === 'Lead').length;

  // Check if current user is a Paralegal (cannot assign team members)
  const canManageTeam = currentUserRole !== 'Paralegal';

  const handleRemoveClick = (member: CaseTeamMember) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;

    try {
      await removeTeamMember({
        caseId,
        userId: memberToRemove.userId,
      });
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  // Check if a member can be removed (not if they're the last Lead)
  const canRemoveMember = (member: CaseTeamMember): boolean => {
    const isLead = member.role === 'Lead';
    if (isLead && leadCount <= 1) {
      return false; // Cannot remove last Lead
    }
    return canManageTeam;
  };

  return (
    <div className="space-y-4">
      {/* Add Team Member Button */}
      {canManageTeam && (
        <div className="flex justify-end">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Team Member
          </button>
        </div>
      )}

      {/* Team Members List */}
      {teamMembers && teamMembers.length > 0 ? (
        <div className="space-y-3">
          {teamMembers.map((member) => {
            const removable = canRemoveMember(member);

            return (
              <div
                key={member.id}
                className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {member.user.firstName} {member.user.lastName}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{member.user.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      {member.role}
                    </span>
                    {member.assignedAt && (
                      <span className="text-xs text-gray-500">
                        Assigned {formatDate(member.assignedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                {canManageTeam && (
                  <button
                    onClick={() => handleRemoveClick(member)}
                    disabled={!removable}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    aria-label={`Remove ${member.user.firstName} ${member.user.lastName}`}
                    title={
                      !removable && member.role === 'Lead'
                        ? 'Cannot remove the last Lead from the case'
                        : `Remove ${member.user.firstName} ${member.user.lastName}`
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-6">
          No team members assigned yet.
        </p>
      )}

      {/* Add Team Member Modal */}
      <AddTeamMemberModal caseId={caseId} open={addModalOpen} onOpenChange={setAddModalOpen} />

      {/* Remove Confirmation Dialog */}
      {memberToRemove && (
        <RemoveConfirmDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          onConfirm={handleConfirmRemove}
          memberName={`${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`}
          loading={removing}
        />
      )}
    </div>
  );
}
