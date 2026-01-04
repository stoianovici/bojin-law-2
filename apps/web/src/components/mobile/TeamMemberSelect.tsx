'use client';

import { useState } from 'react';
import { UserPlus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMembers, type TeamMember } from '@/hooks/mobile/useTeamMembers';

export interface TeamAssignment {
  userId: string;
  role: 'Lead' | 'Support' | 'Observer';
}

export interface TeamMemberSelectProps {
  value: TeamAssignment[];
  onChange: (assignments: TeamAssignment[]) => void;
  label?: string;
  error?: string;
}

const roleOptions: TeamAssignment['role'][] = ['Lead', 'Support', 'Observer'];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getRoleBadgeClasses(role: TeamAssignment['role']): string {
  switch (role) {
    case 'Lead':
      return 'bg-blue-500/20 text-blue-400';
    case 'Support':
      return 'bg-zinc-700 text-mobile-text-secondary';
    case 'Observer':
      return 'bg-transparent border border-mobile-border text-mobile-text-tertiary';
    default:
      return '';
  }
}

export function TeamMemberSelect({ value, onChange, label, error }: TeamMemberSelectProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const { members, loading } = useTeamMembers();

  const selectedUserIds = new Set(value.map((a) => a.userId));
  const availableMembers = members.filter((m) => !selectedUserIds.has(m.id));

  const handleRoleChange = (userId: string, newRole: TeamAssignment['role']) => {
    // If changing to Lead, remove Lead from any other member first
    let newAssignments = [...value];

    if (newRole === 'Lead') {
      newAssignments = newAssignments.map((a) =>
        a.role === 'Lead' ? { ...a, role: 'Support' as const } : a
      );
    }

    newAssignments = newAssignments.map((a) => (a.userId === userId ? { ...a, role: newRole } : a));

    onChange(newAssignments);
  };

  const handleRemoveMember = (userId: string) => {
    onChange(value.filter((a) => a.userId !== userId));
  };

  const handleAddMember = (member: TeamMember) => {
    // If no Lead exists, assign as Lead; otherwise assign as Support
    const hasLead = value.some((a) => a.role === 'Lead');
    const newAssignment: TeamAssignment = {
      userId: member.id,
      role: hasLead ? 'Support' : 'Lead',
    };
    onChange([...value, newAssignment]);
    setShowAddMenu(false);
  };

  const toggleAddMenu = () => {
    setShowAddMenu(!showAddMenu);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
      )}

      {/* Selected members with role selectors */}
      <div className="space-y-2">
        {value.map((assignment) => {
          const member = members.find((m) => m.id === assignment.userId);
          if (!member) return null;

          return (
            <div
              key={assignment.userId}
              className="flex items-center gap-3 p-3 bg-mobile-bg-elevated rounded-[12px] border border-mobile-border"
            >
              {/* Avatar (initials) */}
              <div className="w-9 h-9 rounded-full bg-mobile-bg-card flex items-center justify-center text-[13px] text-mobile-text-secondary font-medium">
                {getInitials(member.firstName, member.lastName)}
              </div>

              {/* Name and role */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-mobile-text-primary truncate">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-[13px] text-mobile-text-tertiary truncate">{member.role}</p>
              </div>

              {/* Role selector */}
              <div className="relative">
                <select
                  value={assignment.role}
                  onChange={(e) =>
                    handleRoleChange(assignment.userId, e.target.value as TeamAssignment['role'])
                  }
                  className={cn(
                    'appearance-none px-3 py-1.5 pr-7 rounded-lg text-[13px] font-medium',
                    'outline-none cursor-pointer',
                    getRoleBadgeClasses(assignment.role)
                  )}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60"
                  strokeWidth={2}
                />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemoveMember(assignment.userId)}
                className="p-1.5 rounded-lg text-mobile-text-tertiary hover:text-mobile-text-secondary hover:bg-mobile-bg-card transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add member button */}
      <div className="relative">
        <button
          type="button"
          onClick={toggleAddMenu}
          disabled={loading || availableMembers.length === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-[12px] w-full',
            'border border-dashed border-mobile-border',
            'text-[15px] text-mobile-text-secondary',
            'hover:border-mobile-accent hover:text-mobile-accent transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-mobile-border disabled:hover:text-mobile-text-secondary'
          )}
        >
          <UserPlus className="w-5 h-5" strokeWidth={2} />
          <span>Adauga membru</span>
        </button>

        {/* Available members dropdown */}
        {showAddMenu && availableMembers.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-mobile-bg-elevated border border-mobile-border rounded-[12px] shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {availableMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleAddMember(member)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-mobile-bg-card transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-mobile-bg-card flex items-center justify-center text-[13px] text-mobile-text-secondary font-medium">
                    {getInitials(member.firstName, member.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-mobile-text-primary truncate">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-[13px] text-mobile-text-tertiary truncate">{member.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showAddMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />}

      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
