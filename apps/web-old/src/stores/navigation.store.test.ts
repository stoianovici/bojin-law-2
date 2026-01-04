/**
 * Navigation Store Tests
 * Tests for Zustand navigation store actions and state management
 */

import { renderHook, act } from '@testing-library/react';
import { useNavigationStore } from './navigation.store';

describe('useNavigationStore', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
    // Reset store state
    useNavigationStore.setState({
      currentSection: 'dashboard',
      currentRole: 'Partner',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const { result } = renderHook(() => useNavigationStore());

      expect(result.current.currentSection).toBe('dashboard');
      expect(result.current.currentRole).toBe('Partner');
      expect(result.current.isSidebarCollapsed).toBe(false);
      expect(result.current.isCommandPaletteOpen).toBe(false);
    });
  });

  describe('setCurrentSection', () => {
    it('should update current section', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentSection('cases');
      });

      expect(result.current.currentSection).toBe('cases');
    });

    it('should handle all valid navigation sections', () => {
      const { result } = renderHook(() => useNavigationStore());

      const sections = [
        'dashboard',
        'cases',
        'documents',
        'tasks',
        'communications',
        'time-tracking',
        'reports',
      ] as const;

      sections.forEach((section) => {
        act(() => {
          result.current.setCurrentSection(section);
        });
        expect(result.current.currentSection).toBe(section);
      });
    });
  });

  describe('setCurrentRole', () => {
    it('should update current role', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentRole('Associate');
      });

      expect(result.current.currentRole).toBe('Associate');
    });

    it('should handle all valid user roles', () => {
      const { result } = renderHook(() => useNavigationStore());

      const roles = ['Partner', 'Associate', 'Paralegal'] as const;

      roles.forEach((role) => {
        act(() => {
          result.current.setCurrentRole(role);
        });
        expect(result.current.currentRole).toBe(role);
      });
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar from collapsed to expanded', () => {
      const { result } = renderHook(() => useNavigationStore());

      expect(result.current.isSidebarCollapsed).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.isSidebarCollapsed).toBe(true);
    });

    it('should toggle sidebar from expanded to collapsed', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.toggleSidebar();
      });
      expect(result.current.isSidebarCollapsed).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });
      expect(result.current.isSidebarCollapsed).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      const { result } = renderHook(() => useNavigationStore());

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.toggleSidebar();
        });
        expect(result.current.isSidebarCollapsed).toBe(i % 2 === 0);
      }
    });
  });

  describe('command palette', () => {
    it('should open command palette', () => {
      const { result } = renderHook(() => useNavigationStore());

      expect(result.current.isCommandPaletteOpen).toBe(false);

      act(() => {
        result.current.openCommandPalette();
      });

      expect(result.current.isCommandPaletteOpen).toBe(true);
    });

    it('should close command palette', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.openCommandPalette();
      });
      expect(result.current.isCommandPaletteOpen).toBe(true);

      act(() => {
        result.current.closeCommandPalette();
      });

      expect(result.current.isCommandPaletteOpen).toBe(false);
    });

    it('should handle multiple open/close cycles', () => {
      const { result } = renderHook(() => useNavigationStore());

      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.openCommandPalette();
        });
        expect(result.current.isCommandPaletteOpen).toBe(true);

        act(() => {
          result.current.closeCommandPalette();
        });
        expect(result.current.isCommandPaletteOpen).toBe(false);
      }
    });
  });

  describe('localStorage persistence', () => {
    it('should persist sidebar collapsed state', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.toggleSidebar();
      });

      const stored = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      expect(stored.state.isSidebarCollapsed).toBe(true);
    });

    it('should persist current role', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentRole('Paralegal');
      });

      const stored = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      expect(stored.state.currentRole).toBe('Paralegal');
    });

    it('should persist current section', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentSection('documents');
      });

      const stored = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      expect(stored.state.currentSection).toBe('documents');
    });

    it('should not persist command palette state', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.openCommandPalette();
      });

      const stored = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      expect(stored.state.isCommandPaletteOpen).toBeUndefined();
    });
  });

  describe('state independence', () => {
    it('should not affect other state when updating current section', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentRole('Associate');
        result.current.toggleSidebar();
      });

      const initialRole = result.current.currentRole;
      const initialCollapsed = result.current.isSidebarCollapsed;

      act(() => {
        result.current.setCurrentSection('tasks');
      });

      expect(result.current.currentRole).toBe(initialRole);
      expect(result.current.isSidebarCollapsed).toBe(initialCollapsed);
    });

    it('should not affect navigation when toggling command palette', () => {
      const { result } = renderHook(() => useNavigationStore());

      act(() => {
        result.current.setCurrentSection('cases');
      });

      const initialSection = result.current.currentSection;

      act(() => {
        result.current.openCommandPalette();
      });

      expect(result.current.currentSection).toBe(initialSection);
    });
  });
});
