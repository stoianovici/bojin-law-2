'use client';

import { useCallback, useEffect } from 'react';

interface UseCaseKeyboardNavProps<T extends { id: string }> {
  cases: T[];
  selectedCaseId: string | null;
  selectCase: (id: string) => void;
  onNewCase?: () => void;
  onEnter?: () => void;
}

export function useCaseKeyboardNav<T extends { id: string }>({
  cases,
  selectedCaseId,
  selectCase,
  onNewCase,
  onEnter,
}: UseCaseKeyboardNavProps<T>) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if focus is in an input or textarea
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'j': {
          // Next case
          e.preventDefault();
          if (cases.length === 0) return;

          const currentIndex = selectedCaseId
            ? cases.findIndex((c) => c.id === selectedCaseId)
            : -1;
          const nextIndex = currentIndex < cases.length - 1 ? currentIndex + 1 : 0;
          selectCase(cases[nextIndex].id);
          break;
        }
        case 'k': {
          // Previous case
          e.preventDefault();
          if (cases.length === 0) return;

          const currentIndex = selectedCaseId ? cases.findIndex((c) => c.id === selectedCaseId) : 0;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : cases.length - 1;
          selectCase(cases[prevIndex].id);
          break;
        }
        case 'enter': {
          e.preventDefault();
          onEnter?.();
          break;
        }
        case 'n': {
          // New case - only if not holding modifier keys
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            onNewCase?.();
          }
          break;
        }
      }
    },
    [cases, selectedCaseId, selectCase, onNewCase, onEnter]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useCaseKeyboardNav;
