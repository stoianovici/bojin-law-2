/**
 * Navigation Types for Legal Platform
 * Defines types for application navigation, role switching, and UI state
 */

import type { UserRole } from './entities';

/**
 * Navigation sections available in the application
 */
export type NavigationSection =
  | 'dashboard'
  | 'analytics'
  | 'kpis'
  | 'cases'
  | 'documents'
  | 'tasks'
  | 'communications'
  | 'time-tracking'
  | 'reports'
  | 'user-management';

/**
 * Navigation state interface
 * Manages current section, role, sidebar, and command palette state
 */
export interface NavigationState {
  /**
   * Currently active navigation section
   */
  currentSection: NavigationSection;

  /**
   * Currently active user role (for testing/demo purposes)
   */
  currentRole: UserRole;

  /**
   * Whether the sidebar is collapsed
   */
  isSidebarCollapsed: boolean;

  /**
   * Whether the command palette modal is open
   */
  isCommandPaletteOpen: boolean;

  /**
   * Set the current active section
   */
  setCurrentSection: (section: NavigationSection) => void;

  /**
   * Set the current active role
   */
  setCurrentRole: (role: UserRole) => void;

  /**
   * Toggle sidebar collapsed state
   */
  toggleSidebar: () => void;

  /**
   * Open the command palette
   */
  openCommandPalette: () => void;

  /**
   * Close the command palette
   */
  closeCommandPalette: () => void;
}

/**
 * Navigation item configuration
 */
export interface NavigationItem {
  /**
   * Unique identifier for the navigation item
   */
  id: string;

  /**
   * Display label (supports Romanian diacritics)
   */
  label: string;

  /**
   * Icon component name or identifier
   */
  icon: string;

  /**
   * Route path for Next.js navigation
   */
  href: string;

  /**
   * Corresponding navigation section
   */
  section: NavigationSection;

  /**
   * Roles that can access this navigation item
   */
  roles: UserRole[];
}

/**
 * Command palette command configuration
 */
export interface Command {
  /**
   * Unique identifier for the command
   */
  id: string;

  /**
   * Display label
   */
  label: string;

  /**
   * Command description
   */
  description: string;

  /**
   * Icon for the command
   */
  icon: string;

  /**
   * Action to execute when command is selected
   */
  action: () => void;

  /**
   * Keywords for search filtering
   */
  keywords: string[];

  /**
   * Associated navigation section (if applicable)
   */
  section?: NavigationSection;
}

/**
 * Quick action configuration for role-based actions
 */
export interface QuickAction {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Display label
   */
  label: string;

  /**
   * Icon for the action
   */
  icon: string;

  /**
   * Action handler
   */
  action: () => void;

  /**
   * Roles that can see this action
   */
  roles: UserRole[];

  /**
   * Optional keyboard shortcut
   */
  shortcut?: string;
}
