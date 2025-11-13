/**
 * Role Switcher Component
 * Allows switching between different user roles for testing
 */

'use client';

import React from 'react';
import * as Select from '@radix-ui/react-select';
import { useNavigationStore } from '@/stores/navigation.store';
import type { UserRole } from '@legal-platform/types';

const roleConfig: Record<UserRole, { color: string; icon: string }> = {
  Partner: { color: 'blue', icon: '👔' },
  Associate: { color: 'green', icon: '⚖️' },
  Paralegal: { color: 'purple', icon: '📋' },
};

export interface RoleSwitcherProps {
  /**
   * Callback when role changes
   */
  onRoleChange?: (role: UserRole) => void;

  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Role Switcher component
 * Features:
 * - Role selection dropdown
 * - Visual feedback with colors and icons
 * - Toast notification on role switch
 * - localStorage persistence via navigation store
 */
export function RoleSwitcher({ onRoleChange, className = '' }: RoleSwitcherProps) {
  const { currentRole, setCurrentRole } = useNavigationStore();

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    onRoleChange?.(role);

    // Show toast notification (simplified - would use a toast library in production)
    console.log(`Switched to ${role} view`);
  };

  const config = roleConfig[currentRole];

  return (
    <div className={className}>
      <Select.Root value={currentRole} onValueChange={handleRoleChange as (value: string) => void}>
        <Select.Trigger
          className="
            flex items-center justify-between gap-2
            w-full px-3 py-2 rounded-lg
            bg-gray-100 hover:bg-gray-200
            text-sm font-medium text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          "
          aria-label="Select role"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">{config.icon}</span>
            <Select.Value />
          </div>
          <Select.Icon>
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="
              overflow-hidden
              bg-white rounded-lg shadow-lg border border-gray-200
              z-50
            "
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport className="p-1">
              {(Object.keys(roleConfig) as UserRole[]).map((role) => {
                const { color, icon } = roleConfig[role];
                return (
                  <Select.Item
                    key={role}
                    value={role}
                    className={`
                      flex items-center gap-2
                      px-3 py-2 rounded-md
                      text-sm cursor-pointer
                      hover:bg-${color}-50
                      focus:bg-${color}-50 focus:outline-none
                      data-[state=checked]:bg-${color}-100
                      transition-colors
                    `}
                  >
                    <span className="text-lg" aria-hidden="true">{icon}</span>
                    <Select.ItemText>{role}</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
