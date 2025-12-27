/**
 * RoleSwitcher Component
 * Dropdown component for switching between user roles in demo mode
 */

'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import type { UserRole } from '@legal-platform/types';

const roleOptions: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'Partner',
    label: 'Partener',
    description: 'Lider de echipă cu acces complet',
  },
  {
    value: 'Associate',
    label: 'Asociat',
    description: 'Avocat cu cazuri asignate',
  },
  {
    value: 'Paralegal',
    label: 'Asociat Jr.',
    description: 'Suport administrativ și documente',
  },
];

export interface RoleSwitcherProps {
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * RoleSwitcher component for demo mode role switching
 */
export function RoleSwitcher({ className = '' }: RoleSwitcherProps) {
  const { currentRole, setCurrentRole } = useNavigationStore();

  const currentRoleOption = roleOptions.find((option) => option.value === currentRole);

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    // Show toast notification
    console.log(`Switched to ${role} view`);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`
            ${className}
            flex items-center gap-2
            px-3 py-2 rounded-lg
            bg-blue-50 hover:bg-blue-100
            border border-blue-200
            text-blue-700 text-sm font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          `}
          aria-label="Switch user role"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>{currentRoleOption?.label || 'Partener'}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="
            min-w-[280px] p-2
            bg-white rounded-lg
            shadow-lg border border-gray-200
            z-50
          "
          align="end"
          sideOffset={5}
        >
          <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Schimbă Rol Demonstrativ
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="h-px my-2 bg-gray-200" />

          {roleOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className={`
                flex flex-col px-3 py-3
                text-sm rounded-md
                cursor-pointer
                hover:bg-gray-100
                focus:bg-gray-100 focus:outline-none
                transition-colors
                ${currentRole === option.value ? 'bg-blue-50 border border-blue-200' : ''}
              `}
              onSelect={() => handleRoleChange(option.value)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{option.label}</span>
                {currentRole === option.value && (
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-500 mt-1">{option.description}</span>
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="h-px my-2 bg-gray-200" />

          <div className="px-3 py-2 text-xs text-gray-500">
            Datele se schimbă în funcție de rol pentru demonstrație
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
