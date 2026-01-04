/**
 * Navigation Store
 * Zustand store for managing navigation state, role switching, and UI state
 * Uses persist middleware to save sidebar collapse state to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NavigationState, NavigationSection } from '@legal-platform/types';
import type { UserRole } from '@legal-platform/types';

/**
 * Navigation store with persistent sidebar and role state
 */
export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      // Initial state
      currentSection: 'dashboard',
      currentRole: 'Partner',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
      isShortcutReferenceOpen: false,

      // Actions
      setCurrentSection: (section: NavigationSection) => set({ currentSection: section }),

      setCurrentRole: (role: UserRole) => set({ currentRole: role }),

      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      openCommandPalette: () => set({ isCommandPaletteOpen: true }),

      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

      openShortcutReference: () => set({ isShortcutReferenceOpen: true }),

      closeShortcutReference: () => set({ isShortcutReferenceOpen: false }),

      toggleShortcutReference: () =>
        set((state) => ({ isShortcutReferenceOpen: !state.isShortcutReferenceOpen })),
    }),
    {
      name: 'navigation-storage', // localStorage key
      // Only persist these fields
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        currentRole: state.currentRole,
        currentSection: state.currentSection,
      }),
    }
  )
);
