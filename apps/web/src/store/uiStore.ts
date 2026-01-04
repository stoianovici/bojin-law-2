import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // View preferences
  activeView: string | null;

  // Context panel
  contextPanelVisible: boolean;
  setContextPanelVisible: (visible: boolean) => void;

  // Mobile navigation
  activeBottomTab: 'acasa' | 'dosare' | 'calendar' | 'cauta';
  setActiveBottomTab: (tab: 'acasa' | 'dosare' | 'calendar' | 'cauta') => void;
  showCreateSheet: boolean;
  createSheetDefaultType: 'case' | 'task' | 'event' | 'note' | null;
  setShowCreateSheet: (
    show: boolean,
    defaultType?: 'case' | 'task' | 'event' | 'note' | null
  ) => void;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  collapseSidebar: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setActiveView: (view: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeView: null,
      contextPanelVisible: true,
      activeBottomTab: 'acasa',
      showCreateSheet: false,
      createSheetDefaultType: null,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      collapseSidebar: (sidebarCollapsed) => set({ sidebarCollapsed }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setActiveView: (activeView) => set({ activeView }),
      setContextPanelVisible: (contextPanelVisible) => set({ contextPanelVisible }),
      setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
      setShowCreateSheet: (showCreateSheet, defaultType) =>
        set({
          showCreateSheet,
          createSheetDefaultType: defaultType ?? null,
        }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        contextPanelVisible: state.contextPanelVisible,
      }),
    }
  )
);
