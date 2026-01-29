import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TutorialState {
  // State
  step: number; // Current step (0-11, 0 means not started)
  isActive: boolean; // Is tutorial currently running
  litRegions: string[]; // Array of data-tutorial selectors that are currently lit
  isCompleted: boolean; // Has tutorial been completed (persisted from backend)

  // Actions
  startTutorial: () => void; // Sets isActive=true, step=1
  advanceStep: () => void; // Increments step
  setStep: (step: number) => void; // Jump to specific step
  addLitRegion: (region: string) => void; // Add a region to lit regions
  removeLitRegion: (region: string) => void; // Remove a region
  setLitRegions: (regions: string[]) => void; // Replace all lit regions
  completeTutorial: () => void; // Sets isActive=false, isCompleted=true
  skipTutorial: () => void; // Sets isActive=false, isCompleted=true (same as complete)
  resetTutorial: () => void; // Resets to initial state (for testing)
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      // Initial state
      step: 0,
      isActive: false,
      litRegions: [],
      isCompleted: false,

      // Actions
      startTutorial: () => set({ isActive: true, step: 1 }),

      advanceStep: () => set((state) => ({ step: state.step + 1 })),

      setStep: (step) => set({ step }),

      addLitRegion: (region) =>
        set((state) => ({
          litRegions: state.litRegions.includes(region)
            ? state.litRegions
            : [...state.litRegions, region],
        })),

      removeLitRegion: (region) =>
        set((state) => ({
          litRegions: state.litRegions.filter((r) => r !== region),
        })),

      setLitRegions: (regions) => set({ litRegions: regions }),

      completeTutorial: () => set({ isActive: false, isCompleted: true }),

      skipTutorial: () => set({ isActive: false, isCompleted: true }),

      resetTutorial: () => set({ step: 0, isActive: false, litRegions: [], isCompleted: false }),
    }),
    {
      name: 'tutorial-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        step: state.step,
        isActive: state.isActive,
        isCompleted: state.isCompleted,
      }),
    }
  )
);
