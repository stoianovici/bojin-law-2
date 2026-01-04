'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMembers, type TeamMember } from '@/hooks/mobile/useTeamMembers';

export interface TeamAssignment {
  userId: string;
  role: 'Lead' | 'Support' | 'Observer';
}

interface TeamMemberSelectProps {
  value: TeamAssignment[];
  onChange: (assignments: TeamAssignment[]) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

const roleOptions: TeamAssignment['role'][] = ['Lead', 'Support', 'Observer'];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getRoleBadgeVariant(role: TeamAssignment['role']): 'info' | 'default' | 'warning' {
  switch (role) {
    case 'Lead':
      return 'info';
    case 'Support':
      return 'default';
    case 'Observer':
      return 'warning';
  }
}

/**
 * Desktop TeamMemberSelect component
 * Multi-select for team assignment with role selection
 */
export function TeamMemberSelect({
  value,
  onChange,
  label,
  error,
  disabled = false,
  className,
}: TeamMemberSelectProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { members, loading } = useTeamMembers();

  const selectedUserIds = new Set(value.map((a) => a.userId));
  const availableMembers = members.filter((m) => !selectedUserIds.has(m.id));

  // Update dropdown position when menu opens
  useEffect(() => {
    if (showAddMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showAddMenu]);

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
    if (!disabled) {
      setShowAddMenu(!showAddMenu);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium text-linear-text-secondary">{label}</label>}

      {/* Selected members with role selectors */}
      <div className="space-y-2">
        {value.map((assignment) => {
          const member = members.find((m) => m.id === assignment.userId);
          if (!member) return null;

          return (
            <div
              key={assignment.userId}
              className="flex items-center gap-3 p-3 bg-linear-bg-secondary rounded-lg border border-linear-border-subtle"
            >
              {/* Avatar (initials) */}
              <div className="w-8 h-8 rounded-full bg-linear-bg-tertiary flex items-center justify-center text-xs text-linear-text-secondary font-medium">
                {getInitials(member.firstName, member.lastName)}
              </div>

              {/* Name and role */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-linear-text-primary truncate">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-xs text-linear-text-tertiary truncate">{member.role}</p>
              </div>

              {/* Role selector */}
              <div className="relative">
                <select
                  value={assignment.role}
                  onChange={(e) =>
                    handleRoleChange(assignment.userId, e.target.value as TeamAssignment['role'])
                  }
                  disabled={disabled}
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
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-60" />
              </div>

              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(assignment.userId)}
                  className="p-1 rounded text-linear-text-tertiary hover:text-linear-error hover:bg-linear-error/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add member button */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleAddMenu}
          disabled={disabled || loading || availableMembers.length === 0}
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

        {/* Available members dropdown - rendered via portal to escape overflow clipping */}
        {showAddMenu &&
          availableMembers.length > 0 &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              {/* Click outside to close */}
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowAddMenu(false)} />
              <div
                className="fixed z-[9999] bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg overflow-hidden"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }}
              >
                <div className="max-h-64 overflow-y-auto">
                  {availableMembers.map((member) => (
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
                        <p className="text-xs text-linear-text-tertiary truncate">{member.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )}
      </div>

      {error && <p className="text-xs text-linear-error">{error}</p>}
    </div>
  );
}
