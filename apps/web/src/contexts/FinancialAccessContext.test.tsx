/**
 * Financial Access Context Tests
 * Story 2.8.3: Role-Based Financial Visibility
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 */

import { render, screen } from '@testing-library/react';
import { FinancialAccessProvider, useFinancialAccess } from './FinancialAccessContext';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AuthProvider } from './AuthContext';
import type { User, UserRole } from '@legal-platform/types';

// Mock user factory for tests
function createMockUser(role: UserRole): User {
  return {
    id: `user-${role.toLowerCase()}`,
    firmId: 'firm-1',
    role,
    email: `${role.toLowerCase()}@example.com`,
    firstName: role === 'BusinessOwner' ? 'Sarah' : 'Test',
    lastName: role,
    status: 'Active',
    azureAdId: `azure-${role.toLowerCase()}`,
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };
}

// Mock AuthContext
jest.mock('./AuthContext', () => ({
  ...jest.requireActual('./AuthContext'),
  useAuth: jest.fn(),
}));

const { useAuth } = require('./AuthContext');

// Test component that uses the hook
// Story 2.11.1: Updated to include isBusinessOwner and financialDataScope
function TestComponent() {
  const { hasFinancialAccess, userRole, isBusinessOwner, financialDataScope } = useFinancialAccess();
  return (
    <div>
      <div data-testid="has-access">{String(hasFinancialAccess)}</div>
      <div data-testid="user-role">{userRole || 'null'}</div>
      <div data-testid="is-business-owner">{String(isBusinessOwner)}</div>
      <div data-testid="financial-scope">{financialDataScope || 'null'}</div>
    </div>
  );
}

describe('FinancialAccessContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFinancialAccess hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useFinancialAccess must be used within a FinancialAccessProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('FinancialAccessProvider', () => {
    it('grants access to Partners with "own" scope', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Partner'),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('true');
      expect(screen.getByTestId('user-role')).toHaveTextContent('Partner');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('false');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('own');
    });

    /**
     * Story 2.11.1: BusinessOwner access tests
     */
    it('grants access to BusinessOwners with "firm" scope', () => {
      useAuth.mockReturnValue({
        user: createMockUser('BusinessOwner'),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('true');
      expect(screen.getByTestId('user-role')).toHaveTextContent('BusinessOwner');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('true');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('firm');
    });

    it('denies access to Associates with null scope', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Associate'),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('false');
      expect(screen.getByTestId('user-role')).toHaveTextContent('Associate');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('false');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('null');
    });

    it('denies access to Paralegals with null scope', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Paralegal'),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('false');
      expect(screen.getByTestId('user-role')).toHaveTextContent('Paralegal');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('false');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('null');
    });

    it('denies access when user is not authenticated', () => {
      useAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('false');
      expect(screen.getByTestId('user-role')).toHaveTextContent('null');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('false');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('null');
    });

    it('denies access when user is null', () => {
      useAuth.mockReturnValue({
        user: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access')).toHaveTextContent('false');
      expect(screen.getByTestId('user-role')).toHaveTextContent('null');
      expect(screen.getByTestId('is-business-owner')).toHaveTextContent('false');
      expect(screen.getByTestId('financial-scope')).toHaveTextContent('null');
    });
  });

  describe('memoization', () => {
    it('memoizes value when user does not change', () => {
      const mockPartner = createMockUser('Partner');

      useAuth.mockReturnValue({
        user: mockPartner,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { rerender } = render(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      const initialAccess = screen.getByTestId('has-access').textContent;
      const initialRole = screen.getByTestId('user-role').textContent;

      // Rerender with same user
      rerender(
        <FinancialAccessProvider>
          <TestComponent />
        </FinancialAccessProvider>
      );

      expect(screen.getByTestId('has-access').textContent).toBe(initialAccess);
      expect(screen.getByTestId('user-role').textContent).toBe(initialRole);
    });
  });
});
