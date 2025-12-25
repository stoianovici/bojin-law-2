/**
 * useCaseEditPermission Hook Tests
 * OPS-207: Expandable Case Workspace Epic
 */

import { renderHook } from '@testing-library/react';
import type { User, UserRole } from '@legal-platform/types';
import { useCaseEditPermission } from './useCaseEditPermission';

// ============================================================================
// Mocks
// ============================================================================

// Mock useAuth
jest.mock('../lib/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// Mock useCase
jest.mock('./useCase', () => ({
  useCase: jest.fn(),
}));

const { useAuth } = require('../lib/hooks/useAuth');
const { useCase } = require('./useCase');

// ============================================================================
// Test Helpers
// ============================================================================

function createMockUser(role: UserRole, id = 'user-1'): User {
  return {
    id,
    firmId: 'firm-1',
    role,
    email: `${role.toLowerCase()}@example.com`,
    firstName: 'Test',
    lastName: role,
    status: 'Active',
    azureAdId: `azure-${role.toLowerCase()}`,
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };
}

interface MockTeamMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

function createMockCase(teamMembers: MockTeamMember[] = []) {
  return {
    id: 'case-1',
    title: 'Test Case',
    teamMembers,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useCaseEditPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Partner access', () => {
    it('grants full edit access to Partners', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Partner'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditFinancials).toBe(true);
      expect(result.current.editReason).toBe('partner');
      expect(result.current.isLoading).toBe(false);
    });

    it('grants Partner access regardless of team membership', () => {
      const partnerId = 'partner-user';
      useAuth.mockReturnValue({
        user: createMockUser('Partner', partnerId),
        isLoading: false,
      });
      // Partner is not in team members
      useCase.mockReturnValue({
        case: createMockCase([
          {
            id: 'tm-1',
            userId: 'other-user',
            role: 'Lead',
            user: {
              id: 'other-user',
              firstName: 'Other',
              lastName: 'User',
              email: 'other@example.com',
            },
          },
        ]),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditFinancials).toBe(true);
      expect(result.current.editReason).toBe('partner');
    });
  });

  describe('BusinessOwner access', () => {
    it('grants full edit access including financials to BusinessOwners', () => {
      useAuth.mockReturnValue({
        user: createMockUser('BusinessOwner'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditFinancials).toBe(true);
      expect(result.current.editReason).toBe('businessOwner');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Lead access', () => {
    it('grants edit access but not financials to case Leads', () => {
      const leadId = 'lead-user';
      useAuth.mockReturnValue({
        user: createMockUser('Associate', leadId),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase([
          {
            id: 'tm-1',
            userId: leadId,
            role: 'Lead',
            user: { id: leadId, firstName: 'Lead', lastName: 'User', email: 'lead@example.com' },
          },
        ]),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditFinancials).toBe(false);
      expect(result.current.editReason).toBe('lead');
    });

    it('denies edit access to team members who are not Lead', () => {
      const memberId = 'member-user';
      useAuth.mockReturnValue({
        user: createMockUser('Associate', memberId),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase([
          {
            id: 'tm-1',
            userId: memberId,
            role: 'Support', // Not Lead
            user: {
              id: memberId,
              firstName: 'Support',
              lastName: 'User',
              email: 'support@example.com',
            },
          },
        ]),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canEditFinancials).toBe(false);
      expect(result.current.editReason).toBe(null);
    });
  });

  describe('No access', () => {
    it('denies access to non-Partner/non-Lead Associates', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Associate'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canEditFinancials).toBe(false);
      expect(result.current.editReason).toBe(null);
    });

    it('denies access to Paralegals', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Paralegal'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canEditFinancials).toBe(false);
      expect(result.current.editReason).toBe(null);
    });

    it('denies access when user is null', () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canEditFinancials).toBe(false);
      expect(result.current.editReason).toBe(null);
    });
  });

  describe('Loading states', () => {
    it('returns isLoading true when auth is loading', () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });
      useCase.mockReturnValue({
        case: null,
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading true when case is loading', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Partner'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: null,
        loading: true,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading false when both are loaded', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Partner'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: createMockCase(),
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles missing teamMembers array gracefully', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Associate'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: { id: 'case-1', title: 'Test', teamMembers: undefined },
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.editReason).toBe(null);
    });

    it('handles null case gracefully', () => {
      useAuth.mockReturnValue({
        user: createMockUser('Associate'),
        isLoading: false,
      });
      useCase.mockReturnValue({
        case: null,
        loading: false,
      });

      const { result } = renderHook(() => useCaseEditPermission('case-1'));

      expect(result.current.canEdit).toBe(false);
      expect(result.current.editReason).toBe(null);
    });
  });
});
