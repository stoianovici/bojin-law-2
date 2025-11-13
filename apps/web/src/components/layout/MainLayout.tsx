/**
 * Main Layout Component
 * Orchestrates the main application layout with navigation
 */

'use client';

import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { RoleSwitcher } from './RoleSwitcher';
import { UserProvider, useUser } from '@/contexts/UserContext';

interface MainLayoutContentProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutContentProps) {
  const { user } = useUser();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar with QuickActions */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar
          userName={`${user.firstName} ${user.lastName}`}
          userRole={user.role}
          unreadCount={3}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Role Switcher - Fixed Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40 w-48 shadow-lg rounded-lg bg-white p-3 border border-gray-200">
        <div className="text-xs text-gray-500 mb-2 font-medium">Switch Role</div>
        <RoleSwitcher />
      </div>

      {/* Command Palette Modal */}
      <CommandPalette />
    </div>
  );
}

export interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Main Layout component
 * Features:
 * - Responsive grid layout
 * - Sidebar with collapse/expand
 * - Top bar navigation
 * - Command palette
 * - Role switcher
 * - Quick actions
 * - User context provider
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <UserProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </UserProvider>
  );
}
