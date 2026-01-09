'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { UserPlus, X, ChevronDown, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useTeamMembers, type TeamMember } from '@/hooks/mobile/useTeamMembers';
import { ASSIGN_TEAM_MEMBER, REMOVE_TEAM_MEMBER } from '@/graphql/mutations';
import { GET_CASES } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

interface CaseTeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface EditTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  currentTeam: CaseTeamMember[];
  onSuccess?: () => void;
}

type TeamRole = 'Lead' | 'Support' | 'Observer';

const roleOptions: TeamRole[] = ['Lead', 'Support', 'Observer'];

// ============================================================================
// Helpers
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================================================
// EditTeamModal Component
// ============================================================================

export function EditTeamModal({
  open,
  onOpenChange,
  caseId,
  currentTeam,
  onSuccess,
}: EditTeamModalProps) {
  // Local state for team edits (tracks what should be the final state)
  const [teamState, setTeamState] = useState<
    Array<{ userId: string; role: TeamRole; isNew?: boolean }>
  >([]);
  const [removedUserIds, setRemovedUserIds] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch available team members
  const { members: availableMembers, loading: loadingMembers } = useTeamMembers();

  // GraphQL mutations - refetch cases list after changes
  const [assignTeamMember] = useMutation(ASSIGN_TEAM_MEMBER, {
    refetchQueries: [{ query: GET_CASES }],
  });
  const [removeTeamMember] = useMutation(REMOVE_TEAM_MEMBER, {
    refetchQueries: [{ query: GET_CASES }],
  });

  // Initialize team state from currentTeam when modal opens
  useEffect(() => {
    if (open) {
      setTeamState(
        currentTeam.map((m) => ({
          userId: m.user.id,
          role: m.role as TeamRole,
        }))
      );
      setRemovedUserIds(new Set());
      setError(null);
    }
  }, [open, currentTeam]);

  // Get members not currently assigned
  const assignedUserIds = new Set(teamState.map((m) => m.userId));
  const unassignedMembers = availableMembers.filter(
    (m) => !assignedUserIds.has(m.id) && !removedUserIds.has(m.id)
  );

  // Handle role change
  const handleRoleChange = useCallback((userId: string, newRole: TeamRole) => {
    setTeamState((prev) => {
      let updated = [...prev];

      // If changing to Lead, demote current Lead to Support
      if (newRole === 'Lead') {
        updated = updated.map((m) =>
          m.role === 'Lead' ? { ...m, role: 'Support' as TeamRole } : m
        );
      }

      // Update the target member's role
      return updated.map((m) => (m.userId === userId ? { ...m, role: newRole } : m));
    });
  }, []);

  // Handle remove member
  const handleRemoveMember = useCallback((userId: string) => {
    setTeamState((prev) => prev.filter((m) => m.userId !== userId));
    setRemovedUserIds((prev) => new Set(prev).add(userId));
  }, []);

  // Handle add member
  const handleAddMember = useCallback((member: TeamMember) => {
    setTeamState((prev) => {
      const hasLead = prev.some((m) => m.role === 'Lead');
      return [
        ...prev,
        {
          userId: member.id,
          role: hasLead ? 'Support' : ('Lead' as TeamRole),
          isNew: true,
        },
      ];
    });
    // Remove from removed set if re-adding
    setRemovedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    setShowAddMenu(false);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Determine what changed
      const originalUserIds = new Set(currentTeam.map((m) => m.user.id));
      const finalUserIds = new Set(teamState.map((m) => m.userId));

      // Users to remove (were in original, not in final)
      const toRemove = currentTeam.filter((m) => !finalUserIds.has(m.user.id));

      // Users to add (in final, not in original)
      const toAdd = teamState.filter((m) => !originalUserIds.has(m.userId));

      // Users whose role changed (in both, but role differs)
      const toUpdate = teamState.filter((m) => {
        const original = currentTeam.find((o) => o.user.id === m.userId);
        return original && original.role !== m.role;
      });

      // Execute removals
      for (const member of toRemove) {
        await removeTeamMember({
          variables: { caseId, userId: member.user.id },
        });
      }

      // Execute additions and updates (assignTeam handles both via upsert behavior)
      for (const member of [...toAdd, ...toUpdate]) {
        await assignTeamMember({
          variables: {
            input: {
              caseId,
              userId: member.userId,
              role: member.role,
            },
          },
        });
      }

      // Close modal and notify parent
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare la salvare');
    } finally {
      setSaving(false);
    }
  }, [caseId, currentTeam, teamState, assignTeamMember, removeTeamMember, onOpenChange, onSuccess]);

  // Check if there are changes
  const hasChanges = useCallback(() => {
    if (teamState.length !== currentTeam.length) return true;

    const originalMap = new Map(currentTeam.map((m) => [m.user.id, m.role]));
    for (const m of teamState) {
      const originalRole = originalMap.get(m.userId);
      if (originalRole !== m.role) return true;
    }
    return false;
  }, [teamState, currentTeam]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editează echipa</DialogTitle>
          <DialogDescription>
            Adaugă sau elimină membrii echipei și atribuie roluri.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 px-6 space-y-4">
          {/* Current team members */}
          <div className="space-y-2">
            {teamState.length === 0 ? (
              <p className="text-sm text-linear-text-tertiary text-center py-4">
                Niciun membru în echipă
              </p>
            ) : (
              teamState.map((assignment) => {
                // Find member details from availableMembers or currentTeam
                const memberDetails =
                  availableMembers.find((m) => m.id === assignment.userId) ||
                  currentTeam.find((m) => m.user.id === assignment.userId)?.user;

                if (!memberDetails) return null;

                const firstName = 'firstName' in memberDetails ? memberDetails.firstName : '';
                const lastName = 'lastName' in memberDetails ? memberDetails.lastName : '';
                const role = 'role' in memberDetails ? memberDetails.role : '';

                return (
                  <div
                    key={assignment.userId}
                    className="flex items-center gap-3 p-3 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-linear-bg-tertiary flex items-center justify-center text-xs text-linear-text-secondary font-medium">
                      {getInitials(firstName, lastName)}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-linear-text-primary truncate">
                        {firstName} {lastName}
                      </p>
                      <p className="text-xs text-linear-text-tertiary truncate">{role}</p>
                    </div>

                    {/* Role selector */}
                    <div className="relative">
                      <select
                        value={assignment.role}
                        onChange={(e) =>
                          handleRoleChange(assignment.userId, e.target.value as TeamRole)
                        }
                        disabled={saving}
                        className={cn(
                          'appearance-none px-2.5 py-1 pr-7 rounded-md text-xs font-medium',
                          'outline-none cursor-pointer border',
                          'bg-linear-bg-elevated border-linear-border-subtle',
                          'focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          assignment.role === 'Lead' &&
                            'text-linear-accent bg-linear-accent/10 border-linear-accent/20',
                          assignment.role === 'Support' && 'text-linear-text-secondary',
                          assignment.role === 'Observer' && 'text-linear-text-tertiary'
                        )}
                      >
                        {roleOptions.map((roleOpt) => (
                          <option key={roleOpt} value={roleOpt}>
                            {roleOpt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-60" />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(assignment.userId)}
                      disabled={saving}
                      className="p-1 rounded text-linear-text-tertiary hover:text-linear-error hover:bg-linear-error/10 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add member button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={saving || loadingMembers || unassignedMembers.length === 0}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-md w-full',
                'border border-dashed border-linear-border-subtle',
                'text-sm text-linear-text-secondary',
                'hover:border-linear-accent hover:text-linear-accent transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-linear-border-subtle disabled:hover:text-linear-text-secondary'
              )}
            >
              <UserPlus className="w-4 h-4" />
              <span>Adaugă membru</span>
            </button>

            {/* Dropdown menu */}
            {showAddMenu && unassignedMembers.length > 0 && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowAddMenu(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 z-[101] bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {unassignedMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleAddMember(member)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-linear-bg-tertiary transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-linear-bg-tertiary flex items-center justify-center text-xs text-linear-text-secondary font-medium">
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-linear-text-primary truncate">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-linear-text-tertiary truncate">
                            {member.role}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg',
                'bg-linear-error/10 border border-linear-error/30'
              )}
            >
              <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-linear-error">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Anulează
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            loading={saving}
          >
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

EditTeamModal.displayName = 'EditTeamModal';

export default EditTeamModal;
