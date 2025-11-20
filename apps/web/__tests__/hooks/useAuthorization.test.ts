/**
 * Tests for Authorization Hook
 * Story 2.4.1: Partner User Management
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useRequireRole, useHasRole, useHasAnyRole } from '../../src/hooks/useAuthorization';
import { useAuth } from '../../src/lib/hooks/useAuth';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../src/lib/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

describe('useAuthorization', () => {
  let mockPush: jest.Mock;
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    mockPush = jest.fn();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('useRequireRole', () => {
    it('should return authorized=true when user has required role', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'partner@test.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useRequireRole('Partner'));

      expect(result.current.authorized).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should redirect to /403 when user lacks required role', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      renderHook(() => useRequireRole('Partner'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/403');
      });
    });

    it('should redirect to /403 when user is not logged in', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      renderHook(() => useRequireRole('Partner'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/403');
      });
    });

    it('should not redirect while loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      renderHook(() => useRequireRole('Partner'));

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('useHasRole', () => {
    it('should return true when user has the specified role', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'partner@test.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole('Partner'));

      expect(result.current).toBe(true);
    });

    it('should return false when user does not have the specified role', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole('Partner'));

      expect(result.current).toBe(false);
    });

    it('should return false when user is not logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole('Partner'));

      expect(result.current).toBe(false);
    });
  });

  describe('useHasAnyRole', () => {
    it('should return true when user has one of the specified roles', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasAnyRole(['Partner', 'Associate']));

      expect(result.current).toBe(true);
    });

    it('should return false when user does not have any of the specified roles', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'paralegal@test.com',
          firstName: 'Test',
          lastName: 'Paralegal',
          role: 'Paralegal',
          status: 'Active',
          firmId: 'firm-1',
          azureAdId: 'azure-1',
          preferences: {},
          createdAt: new Date(),
          lastActive: new Date(),
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasAnyRole(['Partner', 'Associate']));

      expect(result.current).toBe(false);
    });

    it('should return false when user is not logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        clearError: jest.fn(),
      });

      const { result } = renderHook(() => useHasAnyRole(['Partner', 'Associate']));

      expect(result.current).toBe(false);
    });
  });
});
