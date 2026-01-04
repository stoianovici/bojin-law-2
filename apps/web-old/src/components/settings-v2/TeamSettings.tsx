/**
 * Team Settings Component
 * Team member list, invites, and role management (admin only)
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import { Users, UserPlus, MoreHorizontal, Mail, Shield, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ====================================================================
// Types
// ====================================================================

type UserRole = 'Partner' | 'Associate' | 'Paralegal';
type UserStatus = 'Active' | 'Pending' | 'Inactive';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive?: string;
}

// ====================================================================
// Section Card Component
// ====================================================================

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({ title, description, icon, action, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-linear-border-subtle bg-linear-bg-secondary">
      <div className="flex items-center justify-between border-b border-linear-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-linear-text-tertiary">{icon}</span>}
          <div>
            <h3 className="text-sm font-medium text-linear-text-primary">{title}</h3>
            {description && <p className="text-xs text-linear-text-tertiary">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ====================================================================
// Role Badge Component
// ====================================================================

interface RoleBadgeProps {
  role: UserRole;
}

function RoleBadge({ role }: RoleBadgeProps) {
  const roleLabels: Record<UserRole, string> = {
    Partner: 'Partener',
    Associate: 'Asociat',
    Paralegal: 'Asociat Jr.',
  };

  const roleColors: Record<UserRole, string> = {
    Partner: 'bg-purple-500/10 text-purple-400',
    Associate: 'bg-blue-500/10 text-blue-400',
    Paralegal: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        roleColors[role]
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

// ====================================================================
// Status Badge Component
// ====================================================================

interface StatusBadgeProps {
  status: UserStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusLabels: Record<UserStatus, string> = {
    Active: 'Activ',
    Pending: 'În așteptare',
    Inactive: 'Inactiv',
  };

  const statusColors: Record<UserStatus, string> = {
    Active: 'bg-green-500/10 text-green-400',
    Pending: 'bg-yellow-500/10 text-yellow-400',
    Inactive: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusColors[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

// ====================================================================
// Team Member Row Component
// ====================================================================

interface TeamMemberRowProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}

function TeamMemberRow({ member, onEdit, onRemove }: TeamMemberRowProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-linear-accent to-linear-accent/60 text-xs font-semibold text-white">
          {initials}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-linear-text-primary">
              {member.firstName} {member.lastName}
            </span>
            <RoleBadge role={member.role} />
            <StatusBadge status={member.status} />
          </div>
          <p className="text-xs text-linear-text-tertiary">{member.email}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="rounded-lg p-1.5 text-linear-text-tertiary transition-colors hover:bg-linear-bg-tertiary hover:text-linear-text-primary"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onEdit(member);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-linear-text-secondary transition-colors hover:bg-linear-bg-tertiary hover:text-linear-text-primary"
              >
                <Shield className="h-3.5 w-3.5" />
                Schimbă rol
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(member);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Dezactivează
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Invite Modal Component
// ====================================================================

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: UserRole) => void;
}

function InviteModal({ isOpen, onClose, onInvite }: InviteModalProps) {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<UserRole>('Associate');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onInvite(email, role);
      setEmail('');
      setRole('Associate');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-linear-border-subtle bg-linear-bg-secondary">
        <div className="border-b border-linear-border-subtle px-5 py-4">
          <h3 className="text-sm font-medium text-linear-text-primary">Invită membru nou</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">
              Adresa de email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplu.ro"
              required
              className={cn(
                'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
                'placeholder:text-linear-text-muted',
                'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30'
              )}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">
              Rol
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={cn(
                'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
                'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30'
              )}
            >
              <option value="Partner">Partener</option>
              <option value="Associate">Asociat</option>
              <option value="Paralegal">Asociat Jr.</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-linear-border-subtle px-3 py-1.5 text-xs font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-tertiary hover:text-linear-text-primary"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="rounded-lg bg-linear-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-linear-accent/90"
            >
              Trimite invitație
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================================================
// Main Component
// ====================================================================

export function TeamSettings() {
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);

  // Mock team members - in production would fetch from API
  const [members] = React.useState<TeamMember[]>([
    {
      id: '1',
      firstName: 'Alexandru',
      lastName: 'Bojin',
      email: 'alexandru@bojinlaw.ro',
      role: 'Partner',
      status: 'Active',
      lastActive: 'acum 5 minute',
    },
    {
      id: '2',
      firstName: 'Maria',
      lastName: 'Popescu',
      email: 'maria@bojinlaw.ro',
      role: 'Associate',
      status: 'Active',
      lastActive: 'acum 1 oră',
    },
    {
      id: '3',
      firstName: 'Elena',
      lastName: 'Dumitrescu',
      email: 'elena@bojinlaw.ro',
      role: 'Paralegal',
      status: 'Active',
      lastActive: 'ieri',
    },
    {
      id: '4',
      firstName: 'Andrei',
      lastName: 'Ionescu',
      email: 'andrei@bojinlaw.ro',
      role: 'Associate',
      status: 'Pending',
    },
  ]);

  const handleEditMember = (member: TeamMember) => {
    console.log('Edit member:', member);
    // TODO: Implement role change modal
  };

  const handleRemoveMember = (member: TeamMember) => {
    console.log('Remove member:', member);
    // TODO: Implement confirmation and removal
  };

  const handleInvite = (email: string, role: UserRole) => {
    console.log('Invite:', { email, role });
    // TODO: Implement invite API call
  };

  const activeMembers = members.filter((m) => m.status === 'Active');
  const pendingMembers = members.filter((m) => m.status === 'Pending');

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <SectionCard
        title="Membri echipă"
        description={`${activeMembers.length} activi, ${pendingMembers.length} în așteptare`}
        icon={<Users className="h-4 w-4" />}
        action={
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-linear-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-linear-accent/90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invită
          </button>
        }
      >
        <div className="divide-y divide-linear-border-subtle">
          {members.map((member) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              onEdit={handleEditMember}
              onRemove={handleRemoveMember}
            />
          ))}
        </div>
      </SectionCard>

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <SectionCard
          title="Invitații în așteptare"
          description="Utilizatori care nu au acceptat încă invitația"
          icon={<Mail className="h-4 w-4" />}
        >
          <div className="space-y-2">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg bg-linear-bg-tertiary p-3"
              >
                <div>
                  <p className="text-sm text-linear-text-primary">{member.email}</p>
                  <p className="text-xs text-linear-text-tertiary">
                    Invitat ca{' '}
                    {member.role === 'Partner'
                      ? 'Partener'
                      : member.role === 'Associate'
                        ? 'Asociat'
                        : 'Asociat Jr.'}
                  </p>
                </div>
                <button type="button" className="text-xs text-linear-accent hover:underline">
                  Retrimite invitația
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
