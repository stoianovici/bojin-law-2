/**
 * Main Layout Component
 * Orchestrates the main application layout with navigation
 */

'use client';

import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { UserProvider, useUser } from '../../contexts/UserContext';
import { AIAssistantProvider } from '../../contexts/AIAssistantContext';
import { QuickActionsBar } from '../case/QuickActionsBar';
import { useAuth } from '../../lib/hooks/useAuth';

interface MainLayoutContentProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutContentProps) {
  const { user } = useUser();
  const { logout } = useAuth();

  const handleLogout = async () => {
    // Clear local storage and session storage
    localStorage.clear();
    sessionStorage.clear();

    // Call logout from auth context (this will call the backend and redirect)
    await logout();
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      {/* Sidebar with QuickActions - Fixed position, overlays content */}
      <Sidebar />

      {/* Main Content Area - Full width with left padding for collapsed sidebar */}
      <div className="flex flex-col h-screen pl-16 overflow-hidden">
        {/* Top Bar */}
        <TopBar
          userName={`${user.firstName} ${user.lastName}`}
          userRole={user.role}
          unreadCount={3}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette />

      {/* Global AI Assistant */}
      <QuickActionsBar />
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
 * - AI assistant bar
 * - User context provider
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <UserProvider>
      <AIAssistantProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </AIAssistantProvider>
    </UserProvider>
  );
}
