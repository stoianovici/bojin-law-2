import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Sections that support notification badges
type NavSection = 'email' | 'tasks' | 'calendar' | 'documents';

interface NavBadgesState {
  // Stores the count that user has "seen" for each section
  // When current count > seenCount, show badge with difference
  seenCounts: Record<NavSection, number>;

  // Update seen count when user visits a section
  updateSeenCount: (section: NavSection, count: number) => void;

  // Clear all badges (set all seen counts to 0)
  clearAll: () => void;
}

export const useNavBadgesStore = create<NavBadgesState>()(
  persist(
    (set) => ({
      seenCounts: {
        email: 0,
        tasks: 0,
        calendar: 0,
        documents: 0,
      },

      updateSeenCount: (section, count) =>
        set((state) => ({
          seenCounts: {
            ...state.seenCounts,
            [section]: count,
          },
        })),

      clearAll: () =>
        set({
          seenCounts: {
            email: 0,
            tasks: 0,
            calendar: 0,
            documents: 0,
          },
        }),
    }),
    {
      name: 'nav-badges-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
