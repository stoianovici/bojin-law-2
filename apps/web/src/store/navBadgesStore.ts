import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Sections that support notification badges
type NavSection = 'email' | 'tasks' | 'calendar' | 'documents';

interface NavBadgesState {
  // Timestamps of when user last viewed each section
  lastViewed: Record<NavSection, number>;

  // Mark a section as viewed (clears badge)
  markViewed: (section: NavSection) => void;

  // Clear all badges
  clearAll: () => void;
}

export const useNavBadgesStore = create<NavBadgesState>()(
  persist(
    (set) => ({
      lastViewed: {
        email: 0,
        tasks: 0,
        calendar: 0,
        documents: 0,
      },

      markViewed: (section) =>
        set((state) => ({
          lastViewed: {
            ...state.lastViewed,
            [section]: Date.now(),
          },
        })),

      clearAll: () =>
        set({
          lastViewed: {
            email: Date.now(),
            tasks: Date.now(),
            calendar: Date.now(),
            documents: Date.now(),
          },
        }),
    }),
    {
      name: 'nav-badges-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
