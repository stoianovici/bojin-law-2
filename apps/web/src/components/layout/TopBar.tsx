/**
 * TopBar Component
 * Top navigation bar with command palette trigger, notifications, and user menu
 * Includes keyboard shortcut (Cmd+K / Ctrl+K) for command palette
 * Enhanced with role switcher for demo mode
 */

'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import { RoleSwitcher } from './RoleSwitcher';
import { useCurrentTimeDisplay } from '../../lib/hooks/useTimeSimulation';

export interface TopBarProps {
  /**
   * User display name
   */
  userName?: string;

  /**
   * User role for display
   */
  userRole?: string;

  /**
   * Unread notification count
   */
  unreadCount?: number;

  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Callback for logout action
   */
  onLogout?: () => void;

  /**
   * Callback for profile navigation
   */
  onProfile?: () => void;

  /**
   * Callback for settings navigation
   */
  onSettings?: () => void;

  /**
   * Callback for notifications click
   */
  onNotificationsClick?: () => void;
}

/**
 * TopBar component with command palette trigger, notifications, and user menu
 * Features:
 * - Command palette keyboard shortcut (Cmd+K / Ctrl+K)
 * - Notifications badge
 * - User menu dropdown
 * - Role switcher for demo mode
 * - Current time display
 * - Sticky positioning
 * - Responsive design
 */
export function TopBar({
  userName = 'Maria Popescu',
  userRole = 'Partener',
  className = '',
  onLogout,
  onProfile,
  onSettings,
}: TopBarProps) {
  const { toggleSidebar, openCommandPalette, currentRole } = useNavigationStore();
  const { currentTimeDisplay } = useCurrentTimeDisplay();
  const pathname = usePathname();

  // Get page title based on current route and role
  const getPageTitle = () => {
    const roleTitles = {
      Partner: 'Dashboard - Partener',
      Associate: 'Dashboard - Asociat',
      Paralegal: 'Dashboard - Asistent Juridic',
    };

    if (pathname === '/') {
      return roleTitles[currentRole as keyof typeof roleTitles] || 'Dashboard';
    }
    if (pathname?.startsWith('/cases')) return 'Cazuri';
    if (pathname?.startsWith('/tasks')) return 'Sarcini';
    if (pathname?.startsWith('/documents')) return 'Documente';
    if (pathname?.startsWith('/communications')) return 'Comunicări';
    if (pathname?.startsWith('/analytics')) return 'Analytics';
    if (pathname?.startsWith('/reports')) return 'Rapoarte';
    if (pathname?.startsWith('/time-tracking')) return 'Time Tracking';
    return 'Platforma Juridică';
  };

  // Handle keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette]);

  return (
    <header
      className={`
        ${className}
        sticky top-0 z-50
        flex items-center justify-between
        h-16 px-4
        bg-white border-b border-gray-200
        shadow-sm
      `}
    >
      {/* Left section: Hamburger menu and Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="
            p-2 rounded-lg
            hover:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          "
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">{getPageTitle()}</h1>
      </div>

      {/* Center section: Current time */}
      <div className="hidden md:flex items-center text-sm text-gray-600">
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {currentTimeDisplay}
      </div>

      {/* Right section: Role switcher, Command palette, Notifications, User menu */}
      <div className="flex items-center gap-2">
        {/* Role Switcher */}
        <RoleSwitcher />

        {/* Command Palette Trigger Button */}
        <button
          onClick={openCommandPalette}
          className="
            flex items-center gap-2
            px-3 py-2 rounded-lg
            bg-gray-100 hover:bg-gray-200
            text-gray-700 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
            hidden md:flex
          "
          aria-label="Open command palette (Cmd+K)"
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="hidden lg:inline">Caută</span>
          <kbd className="hidden lg:inline px-2 py-0.5 text-xs bg-white border border-gray-300 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Mobile command palette button */}
        <button
          onClick={openCommandPalette}
          className="
            md:hidden
            p-2 rounded-lg
            hover:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          "
          aria-label="Open command palette"
        >
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        {/* User Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="
                flex items-center gap-2
                p-2 rounded-lg
                hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-900">{userName}</div>
                <div className="text-xs text-gray-500">{userRole}</div>
              </div>
              <svg
                className="w-4 h-4 text-gray-500 hidden md:block"
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
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="
                min-w-[220px] p-2
                bg-white rounded-lg
                shadow-lg border border-gray-200
                z-50
              "
              align="end"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="
                  flex items-center gap-3 px-3 py-2
                  text-sm text-gray-700
                  rounded-md
                  cursor-pointer
                  hover:bg-gray-100
                  focus:bg-gray-100 focus:outline-none
                  transition-colors
                "
                onSelect={onProfile}
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
                Profil
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="
                  flex items-center gap-3 px-3 py-2
                  text-sm text-gray-700
                  rounded-md
                  cursor-pointer
                  hover:bg-gray-100
                  focus:bg-gray-100 focus:outline-none
                  transition-colors
                "
                onSelect={onSettings}
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Setări
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px my-2 bg-gray-200" />

              <DropdownMenu.Item
                className="
                  flex items-center gap-3 px-3 py-2
                  text-sm text-red-600
                  rounded-md
                  cursor-pointer
                  hover:bg-red-50
                  focus:bg-red-50 focus:outline-none
                  transition-colors
                "
                onSelect={onLogout}
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Deconectare
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
